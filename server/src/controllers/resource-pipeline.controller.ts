import { env } from "@/config";
import { container } from "@/container";
import {
  ResolutionClaimSchema,
  ResolutionResultSchema,
  ResourceMediaClaimSchema,
  ResourceMediaResultSchema,
} from "@/dto/url-unfurl.dto";
import { factory } from "@/factory";
import type { Context } from "hono";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import {
  isFreshPipelineCallbackTimestamp,
  isValidPipelineCallbackSignature,
} from "@/services/image-upload/callback-auth";

async function readSignedJson(c: Pick<Context, "req">) {
  const secret = env.RESOURCE_PIPELINE_CALLBACK_SECRET;
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
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      "Invalid resource pipeline signature",
    );
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Resource pipeline body must be JSON",
    );
  }
}

export const claimUrlResolution = factory.createHandlers(async (c) => {
  const parsed = ResolutionClaimSchema.safeParse(await readSignedJson(c));
  if (!parsed.success)
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid resolution claim");
  return c.json(
    success(
      await container.urlUnfurlService.claimResolution(
        parsed.data.id,
        parsed.data.generation,
      ),
    ),
  );
});

export const reportUrlResolution = factory.createHandlers(async (c) => {
  const parsed = ResolutionResultSchema.safeParse(await readSignedJson(c));
  if (!parsed.success)
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid resolution result");
  return c.json(
    success(
      await container.urlUnfurlService.handleResolutionResult(parsed.data),
    ),
  );
});

export const claimResourceMedia = factory.createHandlers(async (c) => {
  const parsed = ResourceMediaClaimSchema.safeParse(await readSignedJson(c));
  if (!parsed.success)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid resource media claim",
    );
  return c.json(
    success(
      await container.urlUnfurlService.claimResourceMedia(
        parsed.data.id,
        parsed.data.generation,
      ),
    ),
  );
});

export const reportResourceMedia = factory.createHandlers(async (c) => {
  const parsed = ResourceMediaResultSchema.safeParse(await readSignedJson(c));
  if (!parsed.success)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid resource media result",
    );
  return c.json(
    success(
      await container.urlUnfurlService.handleResourceMediaResult(parsed.data),
    ),
  );
});
