import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";

import { env } from "@/config";
import { container } from "@/container";
import { API_V1_PREFIX } from "@/constants";
import { factory } from "@/factory";
import { auth } from "@/lib/auth";
import { AppError, ErrorCode } from "@/lib/errors";
import { errorResponse } from "@/lib/response";
import { requestLogger, securityHeaders } from "@/middleware";
import { getOpenApiSpec } from "@/openapi";
import { apiRoutes } from "@/routes";

const baseApp = factory.createApp();
const healthService = container.cradle.healthService;
const loggerService = container.cradle.loggerService;

baseApp.use(
  "*",
  cors({
    origin: env.CORS_ORIGINS,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

baseApp.use("*", securityHeaders);
baseApp.use("*", requestId());
baseApp.use("*", requestLogger);

baseApp.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(errorResponse(err.code, err.message), err.status);
  }

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  loggerService.error("Unhandled error", { error: err });
  return c.json(
    errorResponse(ErrorCode.INTERNAL_ERROR, "Internal server error"),
    500,
  );
});

export const app = baseApp
  .get("/health", (c) => {
    const result = healthService.checkHealth();
    return c.json(result);
  })
  .get("/openapi.json", (c) => {
    return c.json(getOpenApiSpec());
  })
  .get(
    "/docs",
    Scalar({
      pageTitle: "Aska API Docs",
      url: "/openapi.json",
    }),
  )
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .route(API_V1_PREFIX, apiRoutes);

app.notFound((c) => {
  return c.json(errorResponse(ErrorCode.NOT_FOUND, "Not found"), 404);
});

export type AppType = typeof app;

export default app;
