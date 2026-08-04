import { describe, expect, it } from "vitest";

import { getOtlpSignalEndpoint } from "./otlp-endpoint";

describe("getOtlpSignalEndpoint", () => {
  it("returns undefined without a configured collector", () => {
    expect(getOtlpSignalEndpoint(undefined, "traces")).toBeUndefined();
  });

  it("appends the trace signal path to a collector base URL", () => {
    expect(
      getOtlpSignalEndpoint("https://collector.example/otlp", "traces"),
    ).toBe("https://collector.example/otlp/v1/traces");
  });

  it("normalizes a trailing slash before appending the signal path", () => {
    expect(
      getOtlpSignalEndpoint("https://collector.example/otlp/", "metrics"),
    ).toBe("https://collector.example/otlp/v1/metrics");
  });
});
