import * as Sentry from "@sentry/aws-serverless";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];
type Span = NonNullable<ReturnType<typeof Sentry.getActiveSpan>>;
type SpanAttributes = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[]
>;

let serviceName = "aska.image-workers";

export function initializeSentry(name: string): void {
  serviceName = name;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: sampleRate(),
    enableLogs: true,
    enableMetrics: true,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    initialScope: {
      tags: { service: name },
    },
  });
}

export async function runWithSpan<T>(
  name: string,
  attributes: SpanAttributes,
  operation: (span: Span) => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: "queue.process",
      kind: 4,
      attributes,
    },
    async (span) => {
      try {
        return await operation(span);
      } catch (error) {
        markSpanError(span, error);
        throw error;
      }
    },
  );
}

export function markSpanError(span: Span, error: unknown): void {
  span.setStatus({
    code: 2,
    message: error instanceof Error ? error.message : String(error),
  });
}

export function captureException(
  error: unknown,
  context: {
    pipeline: string;
    messageId: string;
    attempts: number;
  },
): string {
  return Sentry.captureException(error, {
    tags: { pipeline: context.pipeline },
    extra: {
      message_id: context.messageId,
      receive_count: context.attempts,
    },
  });
}

/** Records the duration of a single SQS message processing attempt. */
export function recordMessageDuration(
  queue: string,
  outcome: "success" | "error",
  durationMs: number,
): void {
  Sentry.metrics.distribution("sqs.message.duration", durationMs, {
    unit: "millisecond",
    attributes: { queue, outcome },
  });
}

export function log(
  level: LogLevel,
  message: string,
  attributes?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;

  const sanitized = sanitize(attributes) as Record<string, unknown>;
  Sentry.logger[level](message, sanitized);

  const spanContext = Sentry.getActiveSpan()?.spanContext();
  write(
    level,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      severity_text: level.toUpperCase(),
      body: message,
      service_name: serviceName,
      deployment_environment:
        process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
      ...(spanContext
        ? {
            trace_id: spanContext.traceId,
            span_id: spanContext.spanId,
          }
        : {}),
      ...(Object.keys(sanitized).length > 0 ? { attributes: sanitized } : {}),
    }),
  );
}

function shouldLog(level: LogLevel): boolean {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  const minimum = LOG_LEVELS.includes(configured as LogLevel)
    ? (configured as LogLevel)
    : "info";
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minimum);
}

function sampleRate(): number {
  const configured = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1
    ? configured
    : 0.2;
}

function write(level: LogLevel, output: string): void {
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else if (level === "debug") console.debug(output);
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
