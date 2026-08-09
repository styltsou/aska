// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "aska",
      home: "aws",
      providers: {
        aws: {
          region: "eu-central-1",
        },
        // The personal Live stage has no custom domains or Cloudflare
        // resources. Do not initialise the provider there: it should require
        // only the short-lived AWS credentials obtained by `aws login`.
        ...(input.stage === "dev"
          ? {
              cloudflare: {
                package: "@pulumi/cloudflare",
                version: "6.18.0",
              },
            }
          : {}),
      },
    };
  },
  async run() {
    const clientOrigins = {
      // Personal hybrid development: local Vite -> Live API Lambda -> AWS.
      hybrid: ["http://localhost:5173"],
      // Shared, fully deployed cloud environment. Local Vite is intentionally
      // allowed for client work against the deployed API; keep this to the
      // exact local development origin.
      dev: ["https://aska-app.styltsou.com", "http://localhost:5173"],
    };
    const allowedClientOrigins =
      clientOrigins[$app.stage as keyof typeof clientOrigins];
    if (!allowedClientOrigins) {
      throw new Error(
        `No client origins configured for SST stage ${$app.stage}. Add an explicit entry to clientOrigins.`,
      );
    }
    const stableCloudDomains =
      $app.stage === "dev"
        ? {
            app: "aska-app.styltsou.com",
            api: "aska-api.styltsou.com",
            dns: sst.cloudflare.dns({
              // Supplying the zone explicitly keeps the DNS token narrowly
              // scoped to styltsou.com and avoids account-wide zone discovery.
              zone: requireEnvironment("CLOUDFLARE_ZONE_ID"),
              // Cloudflare Access only protects proxied hostnames.
              proxy: true,
            }),
            // CloudFront itself is the media edge and validates the signed
            // cookies, so this record must not introduce another proxy/cache
            // layer in front of the distribution.
            mediaDns: sst.cloudflare.dns({
              zone: requireEnvironment("CLOUDFLARE_ZONE_ID"),
              proxy: false,
            }),
          }
        : undefined;
    const databaseUrl = new sst.Secret("DatabaseUrl");
    const betterAuthSecret = new sst.Secret("BetterAuthSecret");
    const resendApiKey = new sst.Secret("ResendApiKey");
    const pexelsApiKey = new sst.Secret("PexelsApiKey");
    const imagePipelineCallbackSecret = new sst.Secret(
      "ImagePipelineCallbackSecret",
    );
    const sentryDsn = new sst.Secret("SentryDsn");
    // The private key signs CloudFront cookies at runtime; the public key
    // verifies them at the edge. They are generated together once and stored
    // as two secrets, so deployment never needs to re-derive one from the
    // other.
    const cloudFrontPrivateKey = stableCloudDomains
      ? new sst.Secret("CloudFrontMediaPrivateKeyBase64")
      : undefined;
    const cloudFrontPublicKey = stableCloudDomains
      ? new sst.Secret("CloudFrontMediaPublicKey")
      : undefined;
    const sentryEnvironment = getSentryEnvironment(
      "aska-api",
      sentryDsn.value,
    );
    const cloudflareAccessEnvironment = stableCloudDomains
      ? getCloudflareAccessEnvironment()
      : {};
    const createImageQueue = (name: string, deadLetterQueueName: string) => {
      const deadLetterQueue = new sst.aws.Queue(deadLetterQueueName, {
        transform: {
          queue: {
            messageRetentionSeconds: 1209600,
          },
        },
      });
      const queue = new sst.aws.Queue(name, {
        visibilityTimeout: "180 seconds",
        // The worker reports a terminal image status on receive five. Keep one
        // additional receive for a failed terminal callback before preserving
        // the message in the DLQ.
        dlq: { queue: deadLetterQueue.arn, retry: 6 },
      });
      return { queue, deadLetterQueue };
    };
    const {
      queue: imageVariantsQueue,
      deadLetterQueue: imageVariantsDeadLetterQueue,
    } = createImageQueue("ImageVariantsQueue", "ImageVariantsDeadLetterQueue");
    const {
      queue: imagePaletteQueue,
      deadLetterQueue: imagePaletteDeadLetterQueue,
    } = createImageQueue("ImagePaletteQueue", "ImagePaletteDeadLetterQueue");
    const imageUploadTopic = new sst.aws.SnsTopic("ImageUploadTopic");
    const assets = new sst.aws.Bucket("Assets", {
      // SST owns the bucket policy. CloudFront OAC presents its distribution
      // ARN as aws:SourceArn (not aws:SourceAccount), so limit reads to this
      // account's distributions while the viewer policy limits each user to a
      // workspace path.
      policy: stableCloudDomains
        ? [
            {
              principals: [
                { type: "service", identifiers: ["cloudfront.amazonaws.com"] },
              ],
              actions: ["s3:GetObject"],
              paths: ["*"],
              conditions: [
                {
                  test: "StringLike",
                  variable: "AWS:SourceArn",
                  values: [
                    aws
                      .getCallerIdentityOutput({})
                      .accountId.apply(
                        (accountId) =>
                          `arn:aws:cloudfront::${accountId}:distribution/*`,
                      ),
                  ],
                },
              ],
            },
          ]
        : [],
      cors: {
        allowHeaders: ["Content-Type", "Cache-Control"],
        allowMethods: ["GET", "PUT"],
        allowOrigins: allowedClientOrigins,
        maxAge: "15 minutes",
      },
    });
    const media = stableCloudDomains
      ? createMediaDistribution({
          assets,
          domain: "images.styltsou.com",
          dns: stableCloudDomains.mediaDns,
          publicKey: cloudFrontPublicKey!.value,
        })
      : undefined;
    // S3 must be explicitly allowed to publish object-created events to the
    // topic. Keep this policy separate from the queue subscriptions so a
    // missing SNS permission cannot silently prevent both processors from
    // receiving uploads.
    new aws.sns.TopicPolicy("ImageUploadTopicPublishPolicy", {
      arn: imageUploadTopic.arn,
      policy: aws.iam
        .getPolicyDocumentOutput({
          statements: [
            {
              sid: "AllowS3ObjectCreatedNotifications",
              actions: ["sns:Publish"],
              resources: [imageUploadTopic.arn],
              principals: [
                { type: "Service", identifiers: ["s3.amazonaws.com"] },
              ],
              conditions: [
                {
                  test: "ArnEquals",
                  variable: "aws:SourceArn",
                  values: [assets.arn],
                },
              ],
            },
          ],
        })
        .json,
    });
    assets.notify({
      notifications: [
        {
          name: "FanOutOriginalImage",
          topic: imageUploadTopic,
          events: ["s3:ObjectCreated:*"],
        },
      ],
    });
    imageUploadTopic.subscribeQueue(
      "GenerateImageVariants",
      imageVariantsQueue,
    );
    imageUploadTopic.subscribeQueue("ExtractImagePalette", imagePaletteQueue);
    const api = new sst.aws.ApiGatewayV2("Api", {
      ...(stableCloudDomains
        ? {
            domain: {
              name: stableCloudDomains.api,
              dns: stableCloudDomains.dns,
            },
            // Cloudflare Access protects the custom hostname. Disable the
            // default AWS hostname so it cannot bypass that policy.
            transform: {
              api: {
                disableExecuteApiEndpoint: true,
              },
            },
          }
        : {}),
      cors: {
        allowCredentials: true,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "Baggage",
          "Sentry-Trace",
        ],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowOrigins: allowedClientOrigins,
      },
    });
    api.route("$default", {
      handler: "server/src/lambda.handler",
      runtime: "nodejs22.x",
      memory: "1024 MB",
      timeout: "29 seconds",
      link: [assets],
      nodejs: {
        sourcemap: true,
        // Crop rendering runs inline in the API and needs Sharp's native
        // Linux package rather than an esbuild bundle.
        esbuild: { external: ["sharp"] },
      },
      copyFiles: [
        { from: "server/node_modules/sharp", to: "node_modules/sharp" },
        { from: "server/node_modules/@img/colour", to: "node_modules/@img/colour" },
        { from: "server/node_modules/detect-libc", to: "node_modules/detect-libc" },
        { from: "server/node_modules/semver", to: "node_modules/semver" },
        { from: "server/node_modules/@img/sharp-linux-x64", to: "node_modules/@img/sharp-linux-x64" },
        { from: "server/node_modules/@img/sharp-libvips-linux-x64", to: "node_modules/@img/sharp-libvips-linux-x64" },
      ],
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        NODE_ENV: stableCloudDomains ? "production" : "development",
        LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
        LOG_SLOW_REQUEST_MS: process.env.LOG_SLOW_REQUEST_MS ?? "1000",
        LOG_SUCCESS_SAMPLE_RATIO: process.env.LOG_SUCCESS_SAMPLE_RATIO ?? "1",
        DATABASE_URL: databaseUrl.value,
        BETTER_AUTH_SECRET: betterAuthSecret.value,
        BETTER_AUTH_URL: api.url,
        CORS_ORIGINS: allowedClientOrigins.join(","),
        // Only the stable cloud API needs to serve a localhost client across
        // sites. Hybrid retains its existing Better Auth cookie behavior.
        CROSS_SITE_AUTH_COOKIES: stableCloudDomains ? "true" : "false",
        ...(stableCloudDomains ? { AUTH_COOKIE_DOMAIN: ".styltsou.com" } : {}),
        RESEND_API_KEY: resendApiKey.value,
        PEXELS_API_KEY: pexelsApiKey.value,
        IMAGE_PIPELINE_CALLBACK_SECRET: imagePipelineCallbackSecret.value,
        S3_BUCKET: assets.name,
        S3_REGION: "eu-central-1",
        S3_PRESIGNED_UPLOAD_EXPIRES_SECONDS: "900",
        S3_PRESIGNED_READ_EXPIRES_SECONDS: "900",
        ...(media
          ? {
              MEDIA_BASE_URL: media.domainUrl,
              CLOUDFRONT_KEY_PAIR_ID: media.publicKeyId,
              CLOUDFRONT_PRIVATE_KEY_BASE64: cloudFrontPrivateKey!.value,
              CLOUDFRONT_COOKIE_DOMAIN: ".styltsou.com",
              CLOUDFRONT_SIGNED_COOKIE_EXPIRES_SECONDS: "3600",
            }
          : {}),
        MAX_DIRECT_UPLOAD_BYTES: "20971520",
        ...cloudflareAccessEnvironment,
        ...sentryEnvironment,
      },
    });
    new sst.aws.CronV2("MediaCleanup", {
      schedule: "rate(5 minutes)",
      function: {
        handler: "server/src/media-cleanup-lambda.handler",
        runtime: "nodejs22.x",
        memory: "512 MB",
        timeout: "30 seconds",
        link: [assets],
        nodejs: { sourcemap: true },
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
          NODE_ENV: stableCloudDomains ? "production" : "development",
          LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
          DATABASE_URL: databaseUrl.value,
          BETTER_AUTH_SECRET: betterAuthSecret.value,
          BETTER_AUTH_URL: api.url,
          RESEND_API_KEY: resendApiKey.value,
          S3_BUCKET: assets.name,
          S3_REGION: "eu-central-1",
          S3_PRESIGNED_UPLOAD_EXPIRES_SECONDS: "900",
          S3_PRESIGNED_READ_EXPIRES_SECONDS: "900",
          ...(media
            ? {
                MEDIA_BASE_URL: media.domainUrl,
                CLOUDFRONT_KEY_PAIR_ID: media.publicKeyId,
                CLOUDFRONT_PRIVATE_KEY_BASE64: cloudFrontPrivateKey!.value,
                CLOUDFRONT_COOKIE_DOMAIN: ".styltsou.com",
                CLOUDFRONT_SIGNED_COOKIE_EXPIRES_SECONDS: "3600",
              }
            : {}),
          ...getSentryEnvironment("media-cleanup", sentryDsn.value),
        },
      },
    });
    const imageWorkerFiles = (service: "image-variants" | "image-palette") => [
      {
        from: `services/${service}/node_modules/sharp`,
        to: "node_modules/sharp",
      },
      {
        from: `services/${service}/node_modules/@img/colour`,
        to: "node_modules/@img/colour",
      },
      {
        from: `services/${service}/node_modules/detect-libc`,
        to: "node_modules/detect-libc",
      },
      {
        from: `services/${service}/node_modules/semver`,
        to: "node_modules/semver",
      },
      {
        from: `services/${service}/node_modules/@img/sharp-linux-x64`,
        to: "node_modules/@img/sharp-linux-x64",
      },
      {
        from: `services/${service}/node_modules/@img/sharp-libvips-linux-x64`,
        to: "node_modules/@img/sharp-libvips-linux-x64",
      },
    ];
    const imageWorkerEnvironment = {
      NODE_OPTIONS: "--enable-source-maps",
      NODE_ENV: stableCloudDomains ? "production" : "development",
      PIPELINE_API_BASE_URL: api.url,
      IMAGE_PIPELINE_CALLBACK_SECRET: imagePipelineCallbackSecret.value,
    };
    const imageWorkerDefaults = {
      runtime: "nodejs22.x" as const,
      memory: "2048 MB" as const,
      timeout: "120 seconds" as const,
      link: [assets],
      nodejs: {
        sourcemap: true,
        // Sharp is native code. Keep it external to esbuild and package the
        // Linux runtime installed by Bun, rather than SST's npm-based
        // `nodejs.install` helper.
        esbuild: { external: ["sharp"] },
      },
    };
    imageVariantsQueue.subscribe(
      {
        handler: "services/image-variants/src/lambda.handler",
        ...imageWorkerDefaults,
        copyFiles: imageWorkerFiles("image-variants"),
        environment: {
          ...imageWorkerEnvironment,
          ...getSentryEnvironment("image-variants", sentryDsn.value),
        },
      },
      {
        batch: {
          size: 1,
          partialResponses: true,
        },
      },
    );
    imagePaletteQueue.subscribe(
      {
        handler: "services/image-palette/src/lambda.handler",
        ...imageWorkerDefaults,
        copyFiles: imageWorkerFiles("image-palette"),
        environment: {
          ...imageWorkerEnvironment,
          ...getSentryEnvironment("image-palette", sentryDsn.value),
        },
      },
      {
        batch: {
          size: 1,
          partialResponses: true,
        },
      },
    );
    const client = new sst.aws.StaticSite("Client", {
      path: "client",
      build: {
        command: "bun run build",
        output: "dist",
      },
      // Local Vite is deliberately started in its own terminal. SST dev keeps
      // the backend handlers local while they use the real AWS dev resources.
      dev: false,
      // React Router is a client-side router, so unknown application routes
      // must serve the SPA entry point rather than CloudFront's 404 page.
      errorPage: "index.html",
      ...(stableCloudDomains
        ? {
            domain: {
              name: stableCloudDomains.app,
              dns: stableCloudDomains.dns,
            },
          }
        : {}),
      environment: {
        VITE_SERVER_URL: api.url,
        VITE_SENTRY_DSN: sentryDsn.value,
        VITE_SENTRY_ENVIRONMENT: $app.stage,
        VITE_SENTRY_TRACES_SAMPLE_RATE:
          process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.2",
        ...(process.env.SENTRY_RELEASE
          ? { VITE_SENTRY_RELEASE: process.env.SENTRY_RELEASE }
          : {}),
      },
    });
    return {
      api: api.url,
      client: client.url,
      assetsBucket: assets.name,
      media: media?.domainUrl,
      imageVariantsQueue: imageVariantsQueue.url,
      imageVariantsDeadLetterQueue: imageVariantsDeadLetterQueue.url,
      imagePaletteQueue: imagePaletteQueue.url,
      imagePaletteDeadLetterQueue: imagePaletteDeadLetterQueue.url,
    };
  },
});
function getSentryEnvironment(
  serviceName: string,
  dsn: $util.Input<string>,
): Record<string, $util.Input<string>> {
  return {
    SENTRY_DSN: dsn,
    SENTRY_SERVICE: serviceName,
    SENTRY_ENVIRONMENT: $app.stage,
    SENTRY_TRACES_SAMPLE_RATE:
      process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.2",
    ...(process.env.SENTRY_RELEASE
      ? { SENTRY_RELEASE: process.env.SENTRY_RELEASE }
      : {}),
  };
}

function createMediaDistribution(input: {
  assets: sst.aws.Bucket;
  domain: string;
  dns: ReturnType<typeof sst.cloudflare.dns>;
  publicKey: $util.Input<string>;
}) {
  const originAccessControl = new aws.cloudfront.OriginAccessControl(
    "MediaOriginAccessControl",
    {
      name: `${$app.name}-${$app.stage}-media-s3`,
      description: "Signs CloudFront requests to Aska's private media bucket",
      originAccessControlOriginType: "s3",
      signingBehavior: "always",
      signingProtocol: "sigv4",
    },
  );
  const publicKey = new aws.cloudfront.PublicKey("MediaViewerPublicKey", {
    namePrefix: `${$app.name}-${$app.stage}-media-`,
    comment: "Verifies signed cookies for private Aska media",
    // The secret holds the SPKI public key base64-encoded (same convention as
    // the private key). CloudFront's PublicKey resource expects the PEM form,
    // so decode before registering it.
    encodedKey: $output(input.publicKey).apply((value) =>
      Buffer.from(value, "base64").toString("utf8"),
    ),
  });
  const keyGroup = new aws.cloudfront.KeyGroup("MediaViewerKeyGroup", {
    name: `${$app.name}-${$app.stage}-media-viewers`,
    comment: "Trusted viewer signer for private Aska media",
    items: [publicKey.id],
  });
  const cachePolicy = new aws.cloudfront.CachePolicy("MediaCachePolicy", {
    name: `${$app.name}-${$app.stage}-immutable-media`,
    comment: "Caches immutable media paths without viewer auth material",
    defaultTtl: 31_536_000,
    maxTtl: 31_536_000,
    minTtl: 0,
    parametersInCacheKeyAndForwardedToOrigin: {
      cookiesConfig: { cookieBehavior: "none" },
      headersConfig: { headerBehavior: "none" },
      queryStringsConfig: { queryStringBehavior: "none" },
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
    },
  });
  const responseHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
    "MediaPerformanceHeaders",
    {
      name: `${$app.name}-${$app.stage}-media-performance`,
      comment: "Exposes private media timing to the deployed Aska client",
      customHeadersConfig: {
        items: [
          {
            header: "Timing-Allow-Origin",
            value: "https://aska-app.styltsou.com",
            override: true,
          },
        ],
      },
    },
  );
  const cdn = new sst.aws.Cdn("Media", {
    comment: "Private immutable workspace images for Aska",
    domain: {
      name: input.domain,
      dns: input.dns,
    },
    origins: [
      {
        originId: "assets",
        domainName: input.assets.domain,
        originAccessControlId: originAccessControl.id,
      },
    ],
    defaultCacheBehavior: {
      targetOriginId: "assets",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      viewerProtocolPolicy: "redirect-to-https",
      compress: true,
      cachePolicyId: cachePolicy.id,
      responseHeadersPolicyId: responseHeadersPolicy.id,
      // This makes every distribution request private. The signed-cookie
      // policy itself is limited to an authorized workspace path.
      trustedKeyGroups: [keyGroup.id],
    },
  });

  return {
    // A custom domain is always configured for the media distribution, so the
    // resulting URL is never undefined once resolved.
    domainUrl: cdn.domainUrl.apply((url) => url!),
    publicKeyId: publicKey.id,
  };
}

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for this deployment.`);
  }
  return value;
}

function getCloudflareAccessEnvironment(): Record<string, string> {
  return {
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: requireEnvironment(
      "CLOUDFLARE_ACCESS_TEAM_DOMAIN",
    ),
    CLOUDFLARE_ACCESS_AUD: requireEnvironment("CLOUDFLARE_ACCESS_AUD"),
  };
}
