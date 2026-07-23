import type { ImageAssetVariants } from "@/db/schema";
import type { ImagePipelineCallbackInput } from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";

type CompletedPipelineResult = Extract<
  ImagePipelineCallbackInput,
  { event: "image.variants.completed" }
>;

type PipelineUploadMetadata = {
  storageId: string;
  originalObjectKey: string;
  contentType: string;
  sizeBytes: number;
};

/** Confirms that a worker returned the exact required variants for its upload. */
export function validateCompletedPipelineResult(
  upload: PipelineUploadMetadata,
  input: CompletedPipelineResult,
): void {
  const roles = new Set(input.variants.map((variant) => variant.role));
  if (roles.size !== 2 || !roles.has("display") || !roles.has("preview")) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Pipeline result is missing required variants",
    );
  }

  for (const variant of input.variants) {
    if (
      variant.objectKey !== makeVariantObjectKey(upload.storageId, variant.role)
    ) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Pipeline variant key is invalid",
      );
    }
  }
}

/** Combines worker rendition metadata with the original upload metadata. */
export function toStoredImageVariants(
  upload: PipelineUploadMetadata,
  input: CompletedPipelineResult,
): ImageAssetVariants {
  const variants = Object.fromEntries(
    input.variants.map((variant) => [variant.role, variant]),
  );

  return {
    original: {
      objectKey: upload.originalObjectKey,
      width: input.width,
      height: input.height,
      contentType: upload.contentType,
      sizeBytes: upload.sizeBytes,
    },
    display: variants.display!,
    preview: variants.preview!,
  };
}

/** Returns the deterministic object key reserved for a generated rendition. */
export function makeVariantObjectKey(
  storageId: string,
  role: "display" | "preview",
): string {
  return `assets/${storageId}/${role}.webp`;
}
