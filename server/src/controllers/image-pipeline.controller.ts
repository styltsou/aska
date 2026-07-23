import { env } from "@/config";
import { container } from "@/container";
import { ImagePipelineCallbackSchema } from "@/dto/upload.dto";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import {
  isFreshPipelineCallbackTimestamp,
  isValidPipelineCallbackSignature,
} from "@/services/image-upload/callback-auth";
import type { IImageUploadService } from "@/services/image-upload.service";

const imageUploadService: IImageUploadService = container.imageUploadService;
export const handleImagePipelineCallback = factory.createHandlers(async (c) => {
  const secret = env.IMAGE_PIPELINE_CALLBACK_SECRET;
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
      "Invalid image pipeline callback",
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Image pipeline callback must be JSON",
    );
  }
  const parsed = ImagePipelineCallbackSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid image pipeline callback payload",
    );
  }

  return c.json(
    success(await imageUploadService.handlePipelineCallback(parsed.data)),
  );
});
