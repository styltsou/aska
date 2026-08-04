import {
  context,
  propagation,
  trace,
  type Span,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { Context as HonoContext, Next } from "hono";

import { env } from "@/config/env";
import {
  buildOtelResource,
  ensureContextManager,
  parseOtlpHeaders,
} from "@/observability/config";
import { recordHttpRequestDuration } from "@/observability/metrics";
import { getOtlpSignalEndpoint } from "@/observability/otlp-endpoint";
import { LoggerService } from "@/services/logger.service";

const tracer = trace.getTracer("aska.api");
let provider: NodeTracerProvider | undefined;

// W3C trace context is the portable default used by browsers, Grafana, and
// other OpenTelemetry-aware services. Register it even when exporting is off,
// so inbound traceparent headers still correlate the API's JSON logs.
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

export function initializeTracing(): void {
  if (provider) return;

  ensureContextManager();

  const endpoint = getOtlpSignalEndpoint(
    env.OTEL_EXPORTER_OTLP_ENDPOINT,
    "traces",
  );
  const exporter = endpoint
    ? new OTLPTraceExporter({
        url: endpoint,
        headers: parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
      })
    : undefined;
  provider = new NodeTracerProvider({
    resource: buildOtelResource(),
    ...(exporter
      ? {
          sampler: new ParentBasedSampler({
            root: new TraceIdRatioBasedSampler(env.OTEL_TRACES_SAMPLE_RATIO),
          }),
          spanProcessors: [new BatchSpanProcessor(exporter)],
        }
      : {}),
  });
  // ensureContextManager already installed the context manager and the module
  // registered the W3C propagator, so skip both here.
  provider.register({ contextManager: null, propagator: null });

  // Auto-instrument Node's built-in fetch with diagnostics-channel hooks. This
  // is bundling-safe (no require hooks) and adds a client span per outbound
  // call, e.g. remote image downloads, Resend, and Better Auth.
  if (exporter) {
    registerInstrumentations({
      instrumentations: [new UndiciInstrumentation()],
    });
  }
}

/**
 * Starts the single span every HTTP request needs. Individual services should
 * add spans only around meaningful external boundaries or costly operations.
 */
export async function traceRequest(
  c: HonoContext,
  next: Next,
  logger: LoggerService,
): Promise<void> {
  const startedAt = performance.now();
  const parentContext = propagation.extract(
    context.active(),
    c.req.raw.headers,
  );
  const span = tracer.startSpan(
    `${c.req.method} request`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        "http.request.method": c.req.method,
      },
    },
    parentContext,
  );
  const spanContext = span.spanContext();
  const traceContext = {
    requestId: c.get("requestId"),
    traceId:
      spanContext.traceId === "00000000000000000000000000000000"
        ? (traceIdFromHeader(c.req.header("traceparent")) ?? randomHex(32))
        : spanContext.traceId,
    spanId:
      spanContext.spanId === "0000000000000000"
        ? randomHex(16)
        : spanContext.spanId,
  };

  c.header(
    "Traceparent",
    `00-${traceContext.traceId}-${traceContext.spanId}-01`,
  );

  try {
    await context.with(trace.setSpan(parentContext, span), () =>
      logger.runWithContext(traceContext, next),
    );
  } catch (error) {
    recordException(span, error);
    throw error;
  } finally {
    const route = c.req.routePath || "unmatched";
    span.updateName(`${c.req.method} ${route}`);
    span.setAttribute("http.response.status_code", c.res.status);
    span.setAttribute("http.route", route);
    if (c.res.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
    recordHttpRequestDuration(
      c.req.method,
      route,
      c.res.status,
      performance.now() - startedAt,
    );
    span.end();
  }
}

/** Flushes ended spans before AWS freezes a Lambda invocation. */
export async function flushTracing(): Promise<void> {
  if (!provider) return;
  try {
    await provider.forceFlush();
  } catch (error) {
    // Never fail an otherwise successful request because observability is down.
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity_text: "ERROR",
        body: "Unable to flush OpenTelemetry traces",
        error: serializeError(error),
      }),
    );
  }
}

function traceIdFromHeader(value: string | undefined): string | undefined {
  const match = value?.match(/^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i);
  return match?.[1]?.toLowerCase();
}

function randomHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length / 2));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function recordException(span: Span, error: unknown): void {
  const detail = serializeError(error);
  span.recordException(detail.message);
  span.setStatus({ code: SpanStatusCode.ERROR, message: detail.message });
  span.setAttribute("error.type", detail.type);
}

function serializeError(error: unknown): { type: string; message: string } {
  return error instanceof Error
    ? { type: error.name, message: error.message }
    : { type: "Error", message: String(error) };
}
