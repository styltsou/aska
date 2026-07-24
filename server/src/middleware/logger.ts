import { container } from "@/container";
import { factory } from "@/factory";

const { loggerService } = container;

export const requestLogger = factory.createMiddleware(async (c, next) => {
  const startedAt = performance.now();
  const requestId = c.get("requestId");
  c.header("X-Request-Id", requestId);

  let thrown: unknown;
  try {
    await next();
  } catch (error) {
    thrown = error;
    throw error;
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    const status = thrown ? 500 : c.res.status;
    const route = c.req.routePath || "unmatched";
    const metadata = {
      event_name: "http.server.request",
      request_id: requestId,
      "http.request.method": c.req.method,
      "http.route": route,
      "http.response.status_code": status,
      duration_ms: durationMs,
      ...(durationMs >= slowRequestThresholdMs() ? { slow_request: true } : {}),
      ...(thrown ? { error: thrown } : {}),
    };

    if (status >= 500) loggerService.error("HTTP request failed", metadata);
    else if (status >= 400 || durationMs >= slowRequestThresholdMs())
      loggerService.warn("HTTP request completed", metadata);
    else if (route === "/health")
      loggerService.debug("HTTP request completed", metadata);
    else if (shouldSampleSuccessfulRequest(requestId))
      loggerService.info("HTTP request completed", metadata);
  }
});

function slowRequestThresholdMs(): number {
  const configured = Number(process.env.LOG_SLOW_REQUEST_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 1_000;
}

function shouldSampleSuccessfulRequest(requestId: string): boolean {
  const configured = Number(process.env.LOG_SUCCESS_SAMPLE_RATIO);
  const sampleRate =
    Number.isFinite(configured) && configured >= 0 && configured <= 1
      ? configured
      : 1;
  if (sampleRate === 1) return true;
  if (sampleRate === 0) return false;

  let hash = 0;
  for (const character of requestId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash / 2 ** 32 < sampleRate;
}
