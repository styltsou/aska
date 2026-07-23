import { handle } from "hono/aws-lambda";

import { configureEnv } from "@/config/env";
import app from "./app";

// Lambda configuration is injected as process environment variables. Configure
// it at module initialization so warm invocations reuse the validated config.
configureEnv(process.env as Record<string, unknown>);

export const handler = handle(app);
