import { context } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  resourceFromAttributes,
  type Resource,
} from "@opentelemetry/resources";

import { env } from "@/config/env";
import { APP_VERSION } from "@/constants";

let contextManagerRegistered = false;

export function ensureContextManager(): void {
  if (contextManagerRegistered) return;
  contextManagerRegistered = true;
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
}

export function parseOtlpHeaders(
  value: string | undefined,
): Record<string, string> {
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

export function buildOtelResource(): Resource {
  return resourceFromAttributes({
    "service.name": env.OTEL_SERVICE_NAME,
    "service.version": APP_VERSION,
    "deployment.environment.name": env.NODE_ENV,
  });
}
