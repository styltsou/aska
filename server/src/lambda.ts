import { handle } from "hono/aws-lambda";

import { configureEnv } from "@/config/env";
import { flushLogs, initializeLogs } from "@/observability/logs";
import { flushMetrics, initializeMetrics } from "@/observability/metrics";
import { flushTracing, initializeTracing } from "@/observability/tracing";
import app from "./app";

// Lambda configuration is injected as process environment variables. Configure
// it at module initialization so warm invocations reuse the validated config.
// Metrics must be registered before tracing so auto-instrumentations bind to
// the registered meter provider.
configureEnv(process.env as Record<string, unknown>);
initializeMetrics();
initializeTracing();
initializeLogs();

const honoHandler = handle(app);

export const handler = async (...args: Parameters<typeof honoHandler>) => {
  try {
    return await honoHandler(...args);
  } finally {
    await Promise.all([flushMetrics(), flushTracing(), flushLogs()]);
  }
};
