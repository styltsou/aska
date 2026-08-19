import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

import ipaddr from "ipaddr.js";

const MAX_REDIRECTS = 5;
const ALLOWED_IP_RANGES = new Set(["unicast"]);

export class SafeFetchError extends Error {
  constructor(
    public readonly category:
      | "unsafe_url"
      | "dns_failed"
      | "connect_failed"
      | "timeout"
      | "redirect_limit"
      | "http_error"
      | "content_type"
      | "response_too_large"
      | "empty_response",
    message: string,
    public readonly retryable: boolean,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchOptions = {
  accept: string;
  allowedContentTypes: readonly string[];
  maxBytes: number;
  totalTimeoutMs: number;
  requestTimeoutMs?: number;
  userAgent?: string;
};

export type SafeFetchResult = {
  body: Uint8Array;
  contentType: string;
  finalUrl: string;
  status: number;
  redirectCount: number;
};

export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions,
): Promise<SafeFetchResult> {
  let current = validateNetworkUrl(input);
  const visited = new Set<string>();
  const controller = new AbortController();
  const totalTimer = setTimeout(
    () => controller.abort(),
    options.totalTimeoutMs,
  );

  try {
    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount += 1
    ) {
      if (visited.has(current.toString())) {
        throw new SafeFetchError("redirect_limit", "Redirect loop", false);
      }
      visited.add(current.toString());
      const response = await requestPinned(current, options, controller.signal);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        response.stream.destroy();
        if (!location || redirectCount === MAX_REDIRECTS) {
          throw new SafeFetchError(
            "redirect_limit",
            "Redirect limit exceeded",
            false,
          );
        }
        current = validateNetworkUrl(new URL(location, current));
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        response.stream.destroy();
        throw new SafeFetchError(
          "http_error",
          `Remote request returned ${response.status}`,
          response.status === 408 ||
            response.status === 429 ||
            response.status >= 500,
          response.status,
        );
      }

      const contentType = normalizeContentType(
        response.headers["content-type"],
      );
      if (!contentType || !options.allowedContentTypes.includes(contentType)) {
        response.stream.destroy();
        throw new SafeFetchError(
          "content_type",
          "Unsupported remote content type",
          false,
        );
      }
      const body = await readBoundedBody(
        response.stream,
        options.maxBytes,
        controller.signal,
      );
      if (body.byteLength === 0)
        throw new SafeFetchError(
          "empty_response",
          "Remote response was empty",
          false,
        );
      return {
        body,
        contentType,
        finalUrl: current.toString(),
        status: response.status,
        redirectCount,
      };
    }
    throw new SafeFetchError(
      "redirect_limit",
      "Redirect limit exceeded",
      false,
    );
  } finally {
    clearTimeout(totalTimer);
  }
}

export function validateNetworkUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input) : new URL(input);
  } catch {
    throw new SafeFetchError("unsafe_url", "Invalid URL", false);
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new SafeFetchError(
      "unsafe_url",
      "Only credential-free HTTP(S) URLs are allowed",
      false,
    );
  }
  if (!url.hostname || url.toString().length > 4096) {
    throw new SafeFetchError("unsafe_url", "Invalid URL host", false);
  }
  return url;
}

export function isPublicAddress(address: string): boolean {
  if (!isIP(address)) return false;
  try {
    const parsed = ipaddr.parse(address);
    return ALLOWED_IP_RANGES.has(parsed.range());
  } catch {
    return false;
  }
}

async function resolvePublicAddress(hostname: string) {
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname))
      throw new SafeFetchError(
        "unsafe_url",
        "Host resolves to a non-public address",
        false,
      );
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SafeFetchError("dns_failed", "DNS lookup failed", true);
  }
  if (
    addresses.length === 0 ||
    addresses.some((entry) => !isPublicAddress(entry.address))
  ) {
    throw new SafeFetchError(
      "unsafe_url",
      "Host resolves to a non-public address",
      false,
    );
  }
  return addresses[0]!;
}

async function requestPinned(
  url: URL,
  options: SafeFetchOptions,
  signal: AbortSignal,
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  stream: http.IncomingMessage;
}> {
  const address = await resolvePublicAddress(url.hostname);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "GET",
        signal,
        headers: {
          accept: options.accept,
          "accept-encoding": "identity",
          "user-agent": options.userAgent ?? "Aska-Link-Resolver/1.0",
          referer: "",
        },
        servername: url.hostname,
        lookup: (_hostname, _lookupOptions, callback) => {
          callback(null, address.address, address.family);
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentLength = Number(response.headers["content-length"] ?? 0);
        if (contentLength > options.maxBytes) {
          response.destroy();
          reject(
            new SafeFetchError(
              "response_too_large",
              "Remote response is too large",
              false,
            ),
          );
          return;
        }
        resolve({ status, headers: response.headers, stream: response });
      },
    );
    request.setTimeout(options.requestTimeoutMs ?? 5_000, () => {
      request.destroy(
        new SafeFetchError("timeout", "Remote request timed out", true),
      );
    });
    request.on("error", (error) => {
      if (error instanceof SafeFetchError) reject(error);
      else if (signal.aborted)
        reject(new SafeFetchError("timeout", "Remote request timed out", true));
      else
        reject(
          new SafeFetchError(
            "connect_failed",
            "Remote connection failed",
            true,
          ),
        );
    });
    request.end();
  });
}

async function readBoundedBody(
  stream: http.IncomingMessage,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    if (signal.aborted)
      throw new SafeFetchError("timeout", "Remote request timed out", true);
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBytes) {
      stream.destroy();
      throw new SafeFetchError(
        "response_too_large",
        "Remote response is too large",
        false,
      );
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}

function normalizeContentType(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(";", 1)[0]?.trim().toLowerCase();
}
