import type { ExecutionContext } from "@cloudflare/workers-types";
import { configureEnv, env } from "@/config/env";
import app from "./app";

// For Bun/Node dev — load .env and configure from process.env
// For CF Workers — falls through; env is configured in the fetch handler
try {
  await import("dotenv/config");
} catch {
  // Not a Node/Bun environment — dotenv unavailable
}
try {
  configureEnv(process.env as Record<string, unknown>);
} catch {
  // Will be configured in the fetch handler with CF bindings
}

export default {
  port: env.PORT,
  async fetch(
    request: Request,
    bindings: Record<string, unknown>,
    ctx: ExecutionContext,
  ) {
    configureEnv(bindings);
    return app.fetch(request, bindings, ctx);
  },
};
