/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app() {
    return {
      name: "aska",
      home: "aws",
      providers: {
        aws: {
          region: "eu-central-1",
        },
      },
    };
  },

  async run() {
    const clientOrigins = {
      dev: ["http://localhost:5173", "https://d3lvxwp2ywqq3a.cloudfront.net"],
      // Replace this before the first production deployment.
      production: ["https://replace-with-your-client-domain.example"],
    };
    const allowedClientOrigins =
      clientOrigins[$app.stage as keyof typeof clientOrigins] ??
      clientOrigins.dev;
    const databaseUrl = new sst.Secret("DatabaseUrl");
    const betterAuthSecret = new sst.Secret("BetterAuthSecret");
    const resendApiKey = new sst.Secret("ResendApiKey");
    const imagePipelineCallbackSecret = new sst.Secret(
      "ImagePipelineCallbackSecret",
    );

    const imageDeadLetterQueue = new sst.aws.Queue("ImageDeadLetterQueue", {
      transform: {
        queue: {
          messageRetentionSeconds: 1_209_600,
        },
      },
    });

    const imageQueue = new sst.aws.Queue("ImageQueue", {
      visibilityTimeout: "180 seconds",
      dlq: {
        queue: imageDeadLetterQueue.arn,
        retry: 5,
      },
    });

    const assets = new sst.aws.Bucket("Assets", {
      cors: {
        allowHeaders: ["Content-Type"],
        allowMethods: ["GET", "PUT"],
        allowOrigins: allowedClientOrigins,
        maxAge: "15 minutes",
      },
    });

    assets.notify({
      notifications: [
        {
          name: "ProcessIngestedImage",
          queue: imageQueue,
          events: ["s3:ObjectCreated:*"],
          filterPrefix: "ingest/",
        },
      ],
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowCredentials: true,
        allowHeaders: ["Content-Type", "Authorization"],
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
      environment: {
        DATABASE_URL: databaseUrl.value,
        BETTER_AUTH_SECRET: betterAuthSecret.value,
        BETTER_AUTH_URL: api.url,
        CORS_ORIGINS: allowedClientOrigins.join(","),
        RESEND_API_KEY: resendApiKey.value,
        IMAGE_PIPELINE_CALLBACK_SECRET: imagePipelineCallbackSecret.value,
        S3_BUCKET: assets.name,
        S3_REGION: "eu-central-1",
        S3_PRESIGNED_UPLOAD_EXPIRES_SECONDS: "900",
        S3_PRESIGNED_READ_EXPIRES_SECONDS: "900",
        MAX_DIRECT_UPLOAD_BYTES: "20971520",
      },
    });

    imageQueue.subscribe(
      {
        handler: "services/image-pipeline/src/lambda.handler",
        runtime: "nodejs22.x",
        memory: "2048 MB",
        timeout: "120 seconds",
        link: [assets],
        nodejs: {
          // Sharp is native code. Keep it external to esbuild and package the
          // Linux runtime installed by Bun, rather than SST's npm-based
          // `nodejs.install` helper.
          esbuild: {
            external: ["sharp"],
          },
        },
        copyFiles: [
          {
            from: "services/image-pipeline/node_modules/sharp",
            to: "node_modules/sharp",
          },
          {
            from: "services/image-pipeline/node_modules/@img/colour",
            to: "node_modules/@img/colour",
          },
          {
            from: "services/image-pipeline/node_modules/detect-libc",
            to: "node_modules/detect-libc",
          },
          {
            from: "services/image-pipeline/node_modules/semver",
            to: "node_modules/semver",
          },
          {
            from: "services/image-pipeline/node_modules/@img/sharp-linux-x64",
            to: "node_modules/@img/sharp-linux-x64",
          },
          {
            from: "services/image-pipeline/node_modules/@img/sharp-libvips-linux-x64",
            to: "node_modules/@img/sharp-libvips-linux-x64",
          },
        ],
        environment: {
          PIPELINE_API_BASE_URL: api.url,
          IMAGE_PIPELINE_CALLBACK_SECRET: imagePipelineCallbackSecret.value,
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
      environment: {
        VITE_SERVER_URL: api.url,
      },
    });

    return {
      api: api.url,
      client: client.url,
      assetsBucket: assets.name,
      imageQueue: imageQueue.url,
      imageDeadLetterQueue: imageDeadLetterQueue.url,
    };
  },
});
