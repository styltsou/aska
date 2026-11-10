import { createHash } from "node:crypto";

import { AppError, ErrorCode } from "@/lib/errors";

const SENSITIVE_QUERY_KEY =
  /(?:^|[_-])(?:access[_-]?token|api[_-]?key|auth|authorization|credential|password|passwd|secret|signature|sig|token)(?:$|[_-])/i;

export type NormalizedExternalUrl = {
  originalUrl: string;
  normalizedUrl: string;
  normalizedUrlHash: string;
  hostname: string;
  resolutionAllowed: boolean;
  blockedReason?: "credentials" | "sensitive_query";
};

export function normalizeExternalUrl(value: string): NormalizedExternalUrl {
  const originalUrl = value.trim();
  if (originalUrl.length === 0 || originalUrl.length > 4096) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "URL must be between 1 and 4096 characters",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "URL is invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "URL must use HTTP or HTTPS",
    );
  }

  const hasCredentials = Boolean(parsed.username || parsed.password);
  const hasSensitiveQuery = [...parsed.searchParams.keys()].some((key) =>
    SENSITIVE_QUERY_KEY.test(key),
  );
  parsed.hash = "";
  const normalizedUrl = parsed.toString();

  return {
    originalUrl,
    normalizedUrl,
    normalizedUrlHash: createHash("sha256").update(normalizedUrl).digest("hex"),
    hostname: parsed.hostname.toLowerCase(),
    resolutionAllowed: !hasCredentials && !hasSensitiveQuery,
    ...(hasCredentials
      ? { blockedReason: "credentials" as const }
      : hasSensitiveQuery
        ? { blockedReason: "sensitive_query" as const }
        : {}),
  };
}

export function normalizeDiscoveredUrl(value: string, baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value, baseUrl);
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Resolver returned an invalid URL",
    );
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.toString().length > 4096
  ) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Resolver returned an unsafe URL",
    );
  }
  parsed.hash = "";
  return parsed.toString();
}

export function hashExternalUrl(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
