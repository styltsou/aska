import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_PIPELINE_CALLBACK_AGE_MS = 5 * 60 * 1000;

/** Validates the callback replay window against an injectable clock. */
export function isFreshPipelineCallbackTimestamp(
  value: string,
  now = Date.now(),
): boolean {
  const timestamp = Number(value);
  return (
    Number.isSafeInteger(timestamp) &&
    Math.abs(now - timestamp) <= MAX_PIPELINE_CALLBACK_AGE_MS
  );
}

/** Verifies the Worker HMAC without timing differences for valid-length values. */
export function isValidPipelineCallbackSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const received = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    received.length === expectedBuffer.length &&
    timingSafeEqual(received, expectedBuffer)
  );
}
