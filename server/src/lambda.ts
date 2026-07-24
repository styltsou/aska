import { handle } from "hono/aws-lambda";

import { configureEnv } from "@/config/env";
import { flushTracing, initializeTracing } from "@/observability/tracing";
import app from "./app";

// Lambda configuration is injected as process environment variables. Configure
// it at module initialization so warm invocations reuse the validated config.
configureEnv(process.env as Record<string, unknown>);
initializeTracing();

const honoHandler = handle(app);

export const handler = async (...args: Parameters<typeof honoHandler>) => {
  try {
    return await honoHandler(...args);
  } finally {
    await flushTracing();
  }
};
