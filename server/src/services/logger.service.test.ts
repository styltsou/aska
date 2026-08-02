import { context, trace, SpanKind } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JsonConsoleLogRecordExporter } from "@/observability/logs";
import { LoggerService } from "./logger.service";

const originalLogLevel = process.env.LOG_LEVEL;

beforeEach(() => {
  const logProvider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "aska-api",
      "deployment.environment.name": "test",
    }),
    processors: [
      new SimpleLogRecordProcessor({
        exporter: new JsonConsoleLogRecordExporter(),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(logProvider);
  const tracerProvider = new NodeTracerProvider();
  tracerProvider.register();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLogLevel;
});

describe("LoggerService", () => {
  it("writes a structured, correlated record and redacts sensitive metadata", () => {
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new LoggerService();
    const span = trace
      .getTracer("test")
      .startSpan("test span", { kind: SpanKind.SERVER });

    context.with(trace.setSpan(context.active(), span), () => {
      logger.runWithContext({ requestId: "req_123" }, () =>
        logger.info("Upload created", {
          uploadId: 42,
          authorization: "Bearer should-not-appear",
          nested: { apiKey: "should-not-appear" },
        }),
      );
    });

    const record = JSON.parse(String(write.mock.calls[0]?.[0])) as {
      severity_text: string;
      body: string;
      request_id: string;
      trace_id: string;
      attributes: Record<string, unknown>;
    };
    expect(record).toMatchObject({
      severity_text: "INFO",
      body: "Upload created",
      request_id: "req_123",
      trace_id: span.spanContext().traceId,
      span_id: span.spanContext().spanId,
      service_name: "aska-api",
      deployment_environment: "test",
    });
    expect(record.attributes).toMatchObject({
      uploadId: 42,
      authorization: "[REDACTED]",
      nested: { apiKey: "[REDACTED]" },
    });
    span.end();
  });

  it("honors the configured minimum level", () => {
    process.env.LOG_LEVEL = "warn";
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.info("This is intentionally suppressed");

    expect(write).not.toHaveBeenCalled();
  });
});
