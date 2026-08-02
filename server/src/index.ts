import { configureEnv, env } from "@/config/env";
import { initializeLogs } from "@/observability/logs";
import { initializeMetrics } from "@/observability/metrics";
import { initializeTracing } from "@/observability/tracing";
import app from "./app";

import "dotenv/config";

configureEnv(process.env as Record<string, unknown>);
initializeMetrics();
initializeTracing();
initializeLogs();

export default {
  port: env.PORT,
  fetch: app.fetch,
};
