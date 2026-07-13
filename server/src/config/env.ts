import "dotenv/config";

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

const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENV_VALUES).default(NodeEnv.Development),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform(
      (value) =>
        value
          ?.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean) ?? [],
    ),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  IMAGE_PIPELINE_CALLBACK_SECRET: z.string().min(32).optional(),
  R2_PRESIGNED_UPLOAD_EXPIRES_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(900),
  R2_PRESIGNED_READ_EXPIRES_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(900),
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
