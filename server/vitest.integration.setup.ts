import { configureEnv } from "@/config/env";

configureEnv({
  ...process.env,
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: "integration-test-secret-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "integration-test-key",
});
