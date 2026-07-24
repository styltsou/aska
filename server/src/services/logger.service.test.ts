import { afterEach, describe, expect, it, vi } from "vitest";

import { LoggerService } from "./logger.service";

const originalLogLevel = process.env.LOG_LEVEL;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLogLevel;
});

describe("LoggerService", () => {
  it("writes a structured, correlated record and redacts sensitive metadata", () => {
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.runWithContext(
      { requestId: "req_123", traceId: "a".repeat(32), spanId: "b".repeat(16) },
      () =>
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
      trace_id: "a".repeat(32),
    });
    expect(record.attributes).toMatchObject({
      uploadId: 42,
      authorization: "[REDACTED]",
      nested: { apiKey: "[REDACTED]" },
    });
  });

  it("honors the configured minimum level", () => {
    process.env.LOG_LEVEL = "warn";
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.info("This is intentionally suppressed");

    expect(write).not.toHaveBeenCalled();
  });
});
