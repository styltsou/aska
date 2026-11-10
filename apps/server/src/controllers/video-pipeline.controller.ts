import { container } from "@/container";
import { VideoPipelineCallbackSchema } from "@/dto/upload.dto";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import { readSignedPipelineJson } from "@/services/pipeline-callback-auth";
import { z } from "zod";

export const handleVideoPipelineCallback = factory.createHandlers(async (c) => {
  const parsed = VideoPipelineCallbackSchema.safeParse(
    await readSignedPipelineJson(c),
  );
  if (!parsed.success)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid video pipeline callback payload",
    );
  return c.json(
    success(await container.videoUploadService.handleCallback(parsed.data)),
  );
});

export const claimRemoteVideoImport = factory.createHandlers(async (c) => {
  const parsed = z
    .object({ uploadId: z.number().int().positive() })
    .safeParse(await readSignedPipelineJson(c));
  if (!parsed.success)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid video import claim",
    );
  return c.json(
    success(
      await container.videoUploadService.getRemoteClaim(parsed.data.uploadId),
    ),
  );
});
