import "./instrument";

import { handle } from "hono/aws-lambda";
import * as Sentry from "@sentry/aws-serverless";

import { configureEnv } from "@/config/env";
import app from "./app";

// Lambda configuration is injected as process environment variables. Configure
// it at module initialization so warm invocations reuse the validated config.
configureEnv(process.env as Record<string, unknown>);

const honoHandler = handle(app);

export const handler = Sentry.wrapHandler(honoHandler, {
  flushTimeout: 2_000,
});
