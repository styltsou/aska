import { z } from "zod";

export const NodeEnv = {
  Development: "development",
  Production: "production",
  Test: "test",
} as const;

const NODE_ENV_VALUES = [
  NodeEnv.Development,
  NodeEnv.Production,
  NodeEnv.Test,
] as const;

const DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:5174";

const CloudflareAccessTeamDomain = z
  .string()
  .trim()
  .min(1)
  // Cloudflare displays the team domain as a hostname, while some dashboard
  // locations and our docs use its full HTTPS URL. Accept both forms and keep
  // one canonical issuer/JWKS base URL internally.
  .transform((value) => (value.includes("://") ? value : `https://${value}`))
  .pipe(z.url())
  .refine((value) => new URL(value).protocol === "https:", {
    message: "CLOUDFLARE_ACCESS_TEAM_DOMAIN must use HTTPS",
  })
  .transform((value) => new URL(value).origin);

const MediaBaseUrl = z
  .url("MEDIA_BASE_URL must be a valid URL")
  .transform((value) => new URL(value).origin);

const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENV_VALUES).default(NodeEnv.Development),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOG_SLOW_REQUEST_MS: z.coerce.number().int().min(0).default(1000),
    LOG_SUCCESS_SAMPLE_RATIO: z.coerce.number().min(0).max(1).default(1),
    OTEL_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    OTEL_SERVICE_NAME: z.string().min(1).default("aska-api"),
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
    OTEL_TRACES_SAMPLE_RATIO: z.coerce.number().min(0).max(1).default(1),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
    CROSS_SITE_AUTH_COOKIES: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: CloudflareAccessTeamDomain.optional(),
    CLOUDFLARE_ACCESS_AUD: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default("eu-central-1"),
    // Optional only for local S3-compatible emulators such as LocalStack.
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    IMAGE_PIPELINE_CALLBACK_SECRET: z.string().min(32).optional(),
    S3_PRESIGNED_UPLOAD_EXPIRES_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),
    S3_PRESIGNED_READ_EXPIRES_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),
    // These are set together only in the stable cloud stage. Without them,
    // local and hybrid development deliberately retain S3 presigned reads.
    MEDIA_BASE_URL: MediaBaseUrl.optional(),
    CLOUDFRONT_KEY_PAIR_ID: z.string().min(1).optional(),
    CLOUDFRONT_PRIVATE_KEY_BASE64: z.string().min(1).optional(),
    CLOUDFRONT_COOKIE_DOMAIN: z
      .string()
      .trim()
      .regex(/^\.[a-z0-9.-]+$/i, {
        message:
          "CLOUDFRONT_COOKIE_DOMAIN must be a parent domain such as .example.com",
      })
      .optional(),
    CLOUDFRONT_SIGNED_COOKIE_EXPIRES_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(3600),
    MAX_DIRECT_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024),
    CORS_ORIGINS: z
      .string()
      .default(DEFAULT_CORS_ORIGINS)
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .refine((origins) => origins.length > 0, {
        message: "CORS_ORIGINS must include at least one origin",
      }),
  })
  .refine(
    (value) =>
      Boolean(value.CLOUDFLARE_ACCESS_TEAM_DOMAIN) ===
      Boolean(value.CLOUDFLARE_ACCESS_AUD),
    {
      message:
        "CLOUDFLARE_ACCESS_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD must be set together",
      path: ["CLOUDFLARE_ACCESS_AUD"],
    },
  )
  .refine(
    (value) => {
      const mediaValues = [
        value.MEDIA_BASE_URL,
        value.CLOUDFRONT_KEY_PAIR_ID,
        value.CLOUDFRONT_PRIVATE_KEY_BASE64,
        value.CLOUDFRONT_COOKIE_DOMAIN,
      ];
      return mediaValues.every(Boolean) || mediaValues.every((item) => !item);
    },
    {
      message:
        "MEDIA_BASE_URL, CLOUDFRONT_KEY_PAIR_ID, CLOUDFRONT_PRIVATE_KEY_BASE64, and CLOUDFRONT_COOKIE_DOMAIN must be set together",
      path: ["MEDIA_BASE_URL"],
    },
  )
  .refine(
    (value) =>
      !value.MEDIA_BASE_URL ||
      !value.CLOUDFRONT_COOKIE_DOMAIN ||
      new URL(value.MEDIA_BASE_URL).hostname.endsWith(
        value.CLOUDFRONT_COOKIE_DOMAIN.slice(1),
      ),
    {
      message:
        "CLOUDFRONT_COOKIE_DOMAIN must be a parent domain of MEDIA_BASE_URL",
      path: ["CLOUDFRONT_COOKIE_DOMAIN"],
    },
  );

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function configureEnv(bindings: Record<string, unknown>): void {
  if (_env) return;
  const result = envSchema.safeParse(bindings);
  if (!result.success) {
    console.error("Invalid environment variables:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Invalid environment variables");
  }
  _env = result.data;
}

export const env = new Proxy<Env>({} as Env, {
  get(_, prop) {
    if (!_env) {
      throw new Error(
        `env not initialized (accessed .${String(prop)}). Call configureEnv() first.`,
      );
    }
    return _env[prop as keyof Env];
  },
});
