import { configureEnv, env } from "@/config/env";
import app from "./app";

import "dotenv/config";

configureEnv(process.env as Record<string, unknown>);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
