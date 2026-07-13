import { createMiddleware } from "hono/factory";

const ONE_YEAR_IN_SECONDS = 31536000;

export const securityHeaders = createMiddleware(async (c, next) => {
  const isDocsRoute = c.req.path === "/docs";

  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  c.res.headers.set(
    "Strict-Transport-Security",
    `max-age=${ONE_YEAR_IN_SECONDS}; includeSubDomains`,
  );
  c.res.headers.set(
    "Content-Security-Policy",
    isDocsRoute
      ? "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self'; img-src 'self' data: https:"
      : "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https:",
  );

  await next();
});
