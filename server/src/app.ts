import { Scalar } from "@scalar/hono-api-reference";
import { sentry } from "@sentry/hono/node";
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
const { healthService, loggerService } = container;

baseApp.use(sentry(baseApp));

baseApp.use(
  "*",
  cors({
    origin: (origin) =>
      env.CORS_ORIGINS.includes(origin) ? origin : undefined,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Baggage",
      "Sentry-Trace",
      "X-Inbox-Visible",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    credentials: true,
  }),
);

baseApp.use("*", securityHeaders);
baseApp.use("*", requestId());
baseApp.use("*", requestLogger);

baseApp.use("/api/v1/workspace/:workspaceSlug/inbox/*", async (c, next) => {
  const isCreation =
    c.req.method === "POST" &&
    /\/inbox\/(?:notes|colors|links|images\/(?:uploads|remote)|videos\/(?:uploads|remote))$/.test(
      c.req.path,
    );
  await next();
  if (
    !isCreation ||
    c.req.header("X-Inbox-Visible") !== "1" ||
    c.res.status >= 400
  )
    return;
  const userId = c.get("userId");
  const workspaceSlug = c.req.param("workspaceSlug");
  if (!userId || !workspaceSlug) return;
  try {
    const workspace = await container.collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    await container.assetService.markInboxSeen(workspace.id, userId);
  } catch (error) {
    loggerService.error("Failed to mark inbox seen after creation", { error });
  }
});

baseApp.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(errorResponse(err.code, err.message), err.status);
  }

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  loggerService.error("Unhandled request error", {
    event_name: "exception",
    error: err,
  });
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
