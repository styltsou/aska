import { describe, expect, it } from "vitest";
import { classifyGradientNamingFailure } from "./namer";

describe("classifyGradientNamingFailure", () => {
  it.each([
    ["API key not valid", "missing_api_key"],
    ["429 RESOURCE_EXHAUSTED: quota exceeded", "usage_limit"],
    ["503 service unavailable", "provider_unavailable"],
    ["Unexpected response format", "internal_error"],
  ] as const)("maps %s to %s", (message, expected) => {
    expect(classifyGradientNamingFailure(new Error(message))).toBe(expected);
  });
});
