import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { ExportResultCode, hrTimeToMilliseconds } from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
  type LogRecordExporter,
  type ReadableLogRecord,
} from "@opentelemetry/sdk-logs";

import { env } from "@/config/env";
import {
  buildOtelResource,
  ensureContextManager,
  parseOtlpHeaders,
} from "@/observability/config";

let loggerProvider: LoggerProvider | undefined;

export function initializeLogs(): void {
  if (loggerProvider) return;

  ensureContextManager();

  if (env.OTEL_ENABLED && !env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity_text: "WARN",
        body: "OpenTelemetry is enabled but no OTLP logs endpoint is configured; logs will stay on stdout",
        service_name: env.OTEL_SERVICE_NAME,
      }),
    );
  }

  loggerProvider = new LoggerProvider({
    resource: buildOtelResource(),
    processors: [
      env.OTEL_ENABLED && env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
        ? new BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
              headers: parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
            }),
          })
        : new SimpleLogRecordProcessor({
            exporter: new JsonConsoleLogRecordExporter(),
          }),
    ],
  });

  logs.setGlobalLoggerProvider(loggerProvider);
}

export async function flushLogs(): Promise<void> {
  if (!loggerProvider) return;
  try {
    await loggerProvider.forceFlush();
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity_text: "ERROR",
        body: "Unable to flush OpenTelemetry logs",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/**
 * Writes each log record as a single-line JSON object so stdout stays
 * greppable in local development and CloudWatch.
 */
export class JsonConsoleLogRecordExporter implements LogRecordExporter {
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
