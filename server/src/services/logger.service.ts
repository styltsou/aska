import { AsyncLocalStorage } from "node:async_hooks";

import {
  logs,
  SeverityNumber,
  type LogAttributes,
} from "@opentelemetry/api-logs";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];
type LogContext = {
  requestId?: string;
  traceId?: string;
  spanId?: string;
};

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

const contextStorage = new AsyncLocalStorage<LogContext>();

export interface ILoggerService {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export class LoggerService implements ILoggerService {
  runWithContext<T>(context: LogContext, callback: () => T): T {
    return contextStorage.run(
      { ...contextStorage.getStore(), ...context },
      callback,
    );
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  private log(
    level: LogLevel,
    message: string,
    meta: Record<string, unknown> | undefined,
  ): void {
    if (!shouldLog(level)) return;

    const activeContext = contextStorage.getStore();
    const attributes: LogAttributes = {};
    if (activeContext?.requestId)
      attributes.request_id = activeContext.requestId;
    if (meta && Object.keys(meta).length > 0) {
      Object.assign(attributes, sanitize(meta) as LogAttributes);
    }

    // The trace context is attached by the SDK from the active span, which the
    // request tracing middleware sets around every request.
    logs.getLogger("aska.api").emit({
      severityNumber: SEVERITY[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes,
    });
  }
}

function shouldLog(level: LogLevel): boolean {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  const minimum = LOG_LEVELS.includes(configured as LogLevel)
    ? (configured as LogLevel)
    : "info";
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minimum);
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
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitize(entryValue, entryKey, depth + 1),
        ]),
    );
  }
  return String(value);
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
