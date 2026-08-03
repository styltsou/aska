import {
  context,
  metrics,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
  ValueType,
  type Attributes,
  type Span,
} from "@opentelemetry/api";
import {
  logs,
  SeverityNumber,
  type LogAttributes,
} from "@opentelemetry/api-logs";
import {
  ExportResultCode,
  hrTimeToMilliseconds,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
  type LogRecordExporter,
  type ReadableLogRecord,
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

const tracer = trace.getTracer("aska.image-workers");

let tracerProvider: NodeTracerProvider | undefined;
let loggerProvider: LoggerProvider | undefined;
let meterProvider: MeterProvider | undefined;

export function initializeObservability(serviceName: string): void {
  if (tracerProvider) return;

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  const resource = resourceFromAttributes({
    "service.name": serviceName,
    "deployment.environment.name": process.env.NODE_ENV ?? "development",
  });
  const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const logsEndpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;

  tracerProvider = new NodeTracerProvider({
    resource,
    ...(tracesEndpoint
      ? {
          sampler: new ParentBasedSampler({
            root: new TraceIdRatioBasedSampler(sampleRatio()),
          }),
          spanProcessors: [
            new BatchSpanProcessor(
              new OTLPTraceExporter({
                url: tracesEndpoint,
                headers: parseOtlpHeaders(
                  process.env.OTEL_EXPORTER_OTLP_HEADERS,
                ),
              }),
            ),
          ],
        }
      : {}),
  });
  tracerProvider.register();

  // Register the meter provider before auto-instrumentation so the undici
  // histogram binds to it. A provider is registered even when disabled; with
  // no reader configured instruments are simply discarded.
  const metricsEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
  meterProvider = new MeterProvider({
    resource,
    ...(metricsEndpoint
      ? {
          readers: [
            new PeriodicExportingMetricReader({
              exporter: new OTLPMetricExporter({
                url: metricsEndpoint,
                headers: parseOtlpHeaders(
                  process.env.OTEL_EXPORTER_OTLP_HEADERS,
                ),
              }),
              exportIntervalMillis: 60_000,
            }),
          ],
        }
      : {}),
  });
  metrics.setGlobalMeterProvider(meterProvider);

  // Auto-instrument Node's built-in fetch (pipeline callbacks, any outbound
  // call) with diagnostics-channel hooks. Bundling-safe: no require hooks.
  if (tracesEndpoint) {
    registerInstrumentations({
      instrumentations: [new UndiciInstrumentation()],
    });
  }

  loggerProvider = new LoggerProvider({
    resource,
    processors: [
      logsEndpoint
        ? new BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: logsEndpoint,
              headers: parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
            }),
          })
        : new SimpleLogRecordProcessor({
            exporter: new JsonConsoleLogRecordExporter(),
          }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);
}

export async function flushObservability(): Promise<void> {
  try {
    await Promise.all([
      ...(tracerProvider ? [tracerProvider.forceFlush()] : []),
      ...(loggerProvider ? [loggerProvider.forceFlush()] : []),
      ...(meterProvider ? [meterProvider.forceFlush()] : []),
    ]);
  } catch (error) {
    console.error(
      JSON.stringify({
        severity_text: "ERROR",
        body: "Unable to flush OpenTelemetry exporters",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function runWithSpan<T>(
  name: string,
  attributes: Attributes,
  operation: (span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name, { kind: SpanKind.CONSUMER, attributes });
  try {
    return await context.with(trace.setSpan(context.active(), span), () =>
      operation(span),
    );
  } catch (error) {
    markSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

export function markSpanError(span: Span, error: unknown): void {
  span.recordException(error instanceof Error ? error : String(error));
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
}

/** Records the duration of a single SQS message processing attempt. */
export function recordMessageDuration(
  queue: string,
  outcome: "success" | "error",
  durationMs: number,
): void {
  metrics
    .getMeter("aska.image-workers")
    .createHistogram("sqs.message.duration", {
      description: "Duration of SQS message processing attempts",
      unit: "ms",
      valueType: ValueType.DOUBLE,
    })
    .record(durationMs, { queue, outcome });
}

export function log(
  level: LogLevel,
  message: string,
  attributes?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  logs.getLogger("aska.image-workers").emit({
    severityNumber: SEVERITY[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes: sanitize(attributes) as LogAttributes,
  });
}

function shouldLog(level: LogLevel): boolean {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  const minimum = LOG_LEVELS.includes(configured as LogLevel)
    ? (configured as LogLevel)
    : "info";
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minimum);
}

function sampleRatio(): number {
  const configured = Number(process.env.OTEL_TRACES_SAMPLE_RATIO);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1
    ? configured
    : 1;
}

function parseOtlpHeaders(value: string | undefined): Record<string, string> {
  if (!value) return {};

  return Object.fromEntries(
    value.split(",").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator <= 0) return [];
      const headerValue = entry.slice(separator + 1).trim();
      return [
        [entry.slice(0, separator).trim(), decodeHeaderValue(headerValue)],
      ];
    }),
  );
}

// OTel header values in the OTEL_EXPORTER_OTLP_HEADERS environment variable are
// percent-encoded (per the spec), e.g. `Authorization=Basic%20<token>` where
// %20 is the space inside the Basic auth scheme.
function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

class JsonConsoleLogRecordExporter implements LogRecordExporter {
  export(
    logRecords: ReadableLogRecord[],
    resultCallback: (result: { code: ExportResultCode }) => void,
  ): void {
    for (const logRecord of logRecords) {
      const attributes = { ...logRecord.attributes };
      const requestId = attributes.request_id;
      delete attributes.request_id;
      const severity =
        logRecord.severityText ?? severityText(logRecord.severityNumber);

      write(
        severity,
        JSON.stringify({
          timestamp: new Date(
            hrTimeToMilliseconds(logRecord.hrTime),
          ).toISOString(),
          severity_text: severity,
          body: logRecord.body,
          service_name: logRecord.resource.attributes["service.name"],
          deployment_environment:
            logRecord.resource.attributes["deployment.environment.name"],
          ...(requestId ? { request_id: requestId } : {}),
          ...(logRecord.spanContext
            ? {
                trace_id: logRecord.spanContext.traceId,
                span_id: logRecord.spanContext.spanId,
              }
            : {}),
          ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
        }),
      );
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

function severityText(severity: SeverityNumber | undefined): string {
  if (severity === undefined || severity === SeverityNumber.UNSPECIFIED)
    return "UNSPECIFIED";
  if (severity <= SeverityNumber.DEBUG4) return "DEBUG";
  if (severity <= SeverityNumber.INFO4) return "INFO";
  if (severity <= SeverityNumber.WARN4) return "WARN";
  if (severity <= SeverityNumber.ERROR4) return "ERROR";
  return "FATAL";
}

function write(severity: string, output: string): void {
  if (severity === "ERROR" || severity === "FATAL") console.error(output);
  else if (severity === "WARN") console.warn(output);
  else if (severity === "DEBUG") console.debug(output);
  else console.info(output);
}

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (isSensitiveKey(key)) return "[REDACTED]";
  if (value instanceof Error) return serializeError(value);
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (typeof value === "string")
    return value.length > 10_000 ? `${value.slice(0, 10_000)}…` : value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (depth >= 6) return "[TRUNCATED]";
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitize(item, "", depth + 1));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitize(entryValue, entryKey, depth + 1),
        ]),
    );
  }
  return value;
}

function isSensitiveKey(key: string): boolean {
  return /authorization|cookie|password|secret|token|api[_-]?key|credential/i.test(
    key,
  );
}

function serializeError(error: Error): Record<string, string | undefined> {
  return {
    type: error.name,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  };
}
