import * as Sentry from "@sentry/hono/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoggerService } from "./logger.service";

vi.mock("@sentry/hono/node", () => ({
  getActiveSpan: vi.fn(() => ({
    spanContext: () => ({
      traceId: "1234567890abcdef1234567890abcdef",
      spanId: "1234567890abcdef",
    }),
  })),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const originalLogLevel = process.env.LOG_LEVEL;
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLogLevel;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("LoggerService", () => {
  it("writes a structured, correlated record and redacts sensitive metadata", () => {
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.runWithContext({ requestId: "req_123" }, () =>
      logger.info("Upload created", {
        uploadId: 42,
        authorization: "Bearer should-not-appear",
        nested: { apiKey: "should-not-appear" },
      }),
    );

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
      trace_id: "1234567890abcdef1234567890abcdef",
      span_id: "1234567890abcdef",
      service_name: "aska-api",
      deployment_environment: "test",
    });
    expect(record.attributes).toMatchObject({
      uploadId: 42,
      authorization: "[REDACTED]",
      nested: { apiKey: "[REDACTED]" },
    });
    expect(Sentry.logger.info).toHaveBeenCalledWith(
      "Upload created",
      expect.objectContaining({ request_id: "req_123", uploadId: 42 }),
    );
  });

  it("honors the configured minimum level", () => {
    process.env.LOG_LEVEL = "warn";
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.info("This is intentionally suppressed");

    expect(write).not.toHaveBeenCalled();
  });
});
