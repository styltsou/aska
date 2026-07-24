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
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { Context as HonoContext, Next } from "hono";

import { env } from "@/config/env";
import { APP_VERSION } from "@/constants";
import { LoggerService } from "@/services/logger.service";

const tracer = trace.getTracer("aska.api");
let provider: NodeTracerProvider | undefined;

// W3C trace context is the portable default used by browsers, Grafana, and
// other OpenTelemetry-aware services. Register it even when exporting is off,
// so inbound traceparent headers still correlate the API's JSON logs.
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

export function initializeTracing(): void {
  if (provider || !env.OTEL_ENABLED) return;

  if (!env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity_text: "WARN",
        body: "OpenTelemetry tracing is enabled but no OTLP traces endpoint is configured",
        service_name: env.OTEL_SERVICE_NAME,
      }),
    );
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    headers: parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
  });
  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "service.name": env.OTEL_SERVICE_NAME,
      "service.version": APP_VERSION,
      "deployment.environment.name": env.NODE_ENV,
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(env.OTEL_TRACES_SAMPLE_RATIO),
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();
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

function parseOtlpHeaders(value: string | undefined): Record<string, string> {
  if (!value) return {};

  return Object.fromEntries(
    value.split(",").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator <= 0) return [];
      return [
        [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()],
      ];
    }),
  );
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
