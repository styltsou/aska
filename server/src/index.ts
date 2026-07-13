import { env } from "@/config/env";
import app from "./app";

export default {
  port: env.PORT,
  fetch: app.fetch,
};
