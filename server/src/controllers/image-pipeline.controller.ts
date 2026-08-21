import { container } from "@/container";
import { ImagePipelineCallbackSchema } from "@/dto/upload.dto";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import type { IImageUploadService } from "@/services/image-upload.service";
import { readSignedPipelineJson } from "@/services/pipeline-callback-auth";

const imageUploadService: IImageUploadService = container.imageUploadService;
export const handleImagePipelineCallback = factory.createHandlers(async (c) => {
  const parsed = ImagePipelineCallbackSchema.safeParse(
    await readSignedPipelineJson(c),
  );
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
