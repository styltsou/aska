import type { Context } from "hono";

import { env } from "@/config";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  isFreshPipelineCallbackTimestamp,
  isValidPipelineCallbackSignature,
} from "@/services/image-upload/callback-auth";

/** Reads and verifies a worker-to-API JSON request before domain validation. */
export async function readSignedPipelineJson(
  c: Pick<Context, "req">,
): Promise<unknown> {
  const secret = env.PIPELINE_CALLBACK_SECRET;
  const timestamp = c.req.header("x-aska-timestamp");
  const signature = c.req.header("x-aska-signature");
  const rawBody = await c.req.raw.text();
  if (
    !secret ||
    !timestamp ||
    !signature ||
    !isFreshPipelineCallbackTimestamp(timestamp) ||
    !isValidPipelineCallbackSignature(secret, timestamp, rawBody, signature)
  ) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid pipeline signature");
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Pipeline request body must be JSON",
    );
  }
}
