import { configureEnv, env } from "@/config/env";
import { initializeTracing } from "@/observability/tracing";
import app from "./app";

import "dotenv/config";

configureEnv(process.env as Record<string, unknown>);
initializeTracing();

export default {
  port: env.PORT,
  fetch: app.fetch,
};
