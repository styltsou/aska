import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  isFreshPipelineCallbackTimestamp,
  isValidPipelineCallbackSignature,
  MAX_PIPELINE_CALLBACK_AGE_MS,
} from "./callback-auth";

describe("image pipeline callback authentication", () => {
  it("accepts timestamps within the permitted age window", () => {
    const now = 1_000_000;

    expect(isFreshPipelineCallbackTimestamp(String(now), now)).toBe(true);
    expect(
      isFreshPipelineCallbackTimestamp(
        String(now - MAX_PIPELINE_CALLBACK_AGE_MS),
        now,
      ),
    ).toBe(true);
    expect(
      isFreshPipelineCallbackTimestamp(
        String(now + MAX_PIPELINE_CALLBACK_AGE_MS),
        now,
      ),
    ).toBe(true);
  });

  it("rejects stale, future, and malformed timestamps", () => {
    const now = 1_000_000;

    expect(
      isFreshPipelineCallbackTimestamp(
        String(now - MAX_PIPELINE_CALLBACK_AGE_MS - 1),
        now,
      ),
    ).toBe(false);
    expect(
      isFreshPipelineCallbackTimestamp(
        String(now + MAX_PIPELINE_CALLBACK_AGE_MS + 1),
        now,
      ),
    ).toBe(false);
    expect(isFreshPipelineCallbackTimestamp("not-a-timestamp", now)).toBe(
      false,
    );
    expect(isFreshPipelineCallbackTimestamp("1.5", now)).toBe(false);
  });

  it("validates an exact HMAC signature", () => {
    const secret = "test-secret";
    const timestamp = "1000000";
    const body = '{"status":"processing"}';
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(
      isValidPipelineCallbackSignature(secret, timestamp, body, signature),
    ).toBe(true);
    expect(
      isValidPipelineCallbackSignature(
        secret,
        timestamp,
        '{"status":"failed"}',
        signature,
      ),
    ).toBe(false);
    expect(
      isValidPipelineCallbackSignature(secret, timestamp, body, "not-hex"),
    ).toBe(false);
  });
});
