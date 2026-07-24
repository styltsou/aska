import { container } from "@/container";
import { factory } from "@/factory";
import { traceRequest } from "@/observability/tracing";

const { loggerService } = container;

export const requestTracing = factory.createMiddleware(async (c, next) => {
  await traceRequest(c, next, loggerService);
});
