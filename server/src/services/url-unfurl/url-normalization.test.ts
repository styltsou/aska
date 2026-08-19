import { describe, expect, it } from "vitest";

import { normalizeExternalUrl } from "./url-normalization";

describe("normalizeExternalUrl", () => {
  it("normalizes host and default port while preserving query identity", () => {
    const result = normalizeExternalUrl(
      " HTTPS://Example.COM:443/path?b=2&a=1#section ",
    );
    expect(result.originalUrl).toBe(
      "HTTPS://Example.COM:443/path?b=2&a=1#section",
    );
    expect(result.normalizedUrl).toBe("https://example.com/path?b=2&a=1");
    expect(result.hostname).toBe("example.com");
    expect(result.resolutionAllowed).toBe(true);
  });

  it("does not strip or reorder query parameters", () => {
    expect(
      normalizeExternalUrl("https://example.com/?utm_source=x&id=7&id=8")
        .normalizedUrl,
    ).toBe("https://example.com/?utm_source=x&id=7&id=8");
  });

  it("keeps credential URLs usable but blocks automatic resolution", () => {
    const result = normalizeExternalUrl("https://user:pass@example.com/a");
    expect(result.resolutionAllowed).toBe(false);
    expect(result.blockedReason).toBe("credentials");
  });

  it("blocks clearly sensitive signed query parameters", () => {
    const result = normalizeExternalUrl(
      "https://example.com/file?X-Amz-Signature=secret",
    );
    expect(result.resolutionAllowed).toBe(false);
    expect(result.blockedReason).toBe("sensitive_query");
  });

  it("rejects unsupported schemes", () => {
    expect(() => normalizeExternalUrl("file:///etc/passwd")).toThrow(
      "URL must use HTTP or HTTPS",
    );
  });
});
