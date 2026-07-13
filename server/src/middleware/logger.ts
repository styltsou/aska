import { env } from "@/config/env";
import { container } from "@/container";
import { factory } from "@/factory";

const isDevelopment = env.NODE_ENV === "development";
const loggerService = container.cradle.loggerService;

export const requestLogger = factory.createMiddleware(async (c, next) => {
  const start = Date.now();
  const requestId = c.get("requestId");

  if (isDevelopment) {
    console.log(`-> ${c.req.method} ${c.req.path}`);
  } else {
    loggerService.info("Incoming request", {
      method: c.req.method,
      path: c.req.path,
      requestId,
    });
  }

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  if (isDevelopment) {
    console.log(`<- ${c.req.method} ${c.req.path} ${status} ${duration}ms`);
  } else {
    loggerService.info("Request completed", {
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      requestId,
    });
  }
});
