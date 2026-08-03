import { metrics, ValueType } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";

import { env } from "@/config/env";
import {
  buildOtelResource,
  ensureContextManager,
  parseOtlpHeaders,
} from "@/observability/config";

let meterProvider: MeterProvider | undefined;

export function initializeMetrics(): void {
  if (meterProvider) return;

  ensureContextManager();

  const exporter = env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
    ? new OTLPMetricExporter({
        url: env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
        headers: parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
      })
    : undefined;

  // Register a provider even when disabled so the automatic undici client
  // histogram and any manually recorded metrics resolve to real instruments
  // instead of no-ops; with no reader configured they are simply discarded.
  meterProvider = new MeterProvider({
    resource: buildOtelResource(),
    ...(exporter
      ? {
          readers: [
            new PeriodicExportingMetricReader({
              exporter,
              exportIntervalMillis: 60_000,
            }),
          ],
        }
      : {}),
  });
  metrics.setGlobalMeterProvider(meterProvider);
}

/** Flushes accumulated metrics before AWS freezes a Lambda invocation. */
export async function flushMetrics(): Promise<void> {
  if (!meterProvider) return;
  try {
    await meterProvider.forceFlush();
  } catch (error) {
    // Never fail an otherwise successful request because observability is down.
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity_text: "ERROR",
        body: "Unable to flush OpenTelemetry metrics",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/**
 * Records the duration of an HTTP server request. Call inside the request's
 * active span; the histogram is resolved lazily so it binds to whatever meter
 * provider is registered.
 */
export function recordHttpRequestDuration(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
): void {
  metrics
    .getMeter("aska.api")
    .createHistogram("http.server.request.duration", {
      description: "Duration of API HTTP requests",
      unit: "s",
      valueType: ValueType.DOUBLE,
    })
    .record(durationMs / 1000, {
      "http.request.method": method,
      "http.response.status_code": statusCode,
      "http.route": route,
    });
}
