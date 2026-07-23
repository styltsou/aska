import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { imageAssets, uploads } from "@/db/schema";
import type { ImagePipelineCallbackInput } from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { first } from "@/lib/query";
import {
  toStoredImageVariants,
  validateCompletedPipelineResult,
} from "@/services/image-upload/pipeline-result";
import type { UploadRecord } from "@/services/image-upload/upload-repository";

type CompletedPipelineResult = Extract<
  ImagePipelineCallbackInput,
  { event: "image.variants.completed" }
>;

/** Atomically persists variants for the asset created before browser upload. */
export async function finalizeImageUpload(
  upload: UploadRecord,
  input: CompletedPipelineResult,
): Promise<void> {
  validateCompletedPipelineResult(upload, input);

  await db.transaction(async (tx) => {
    const current = first(
      await tx
        .select({
          status: uploads.status,
          assetId: uploads.assetId,
          processingEtag: uploads.processingEtag,
        })
        .from(uploads)
        .where(eq(uploads.id, upload.id))
        .limit(1),
    );
    if (!current || current.status === "completed") return;
    if (current.status === "failed") {
      throw new AppError(ErrorCode.CONFLICT, "Upload is already failed");
    }
    if (
      current.processingEtag &&
      current.processingEtag !== input.originalEtag
    ) {
      return;
    }

    if (!upload.assetId) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Upload has no image asset");
    }

    const variants = toStoredImageVariants(upload, input);
    await tx
      .update(imageAssets)
      .set({
        width: input.width,
        height: input.height,
        variants,
        blurDataURL: input.blurDataURL,
        variantStatus: "completed",
        variantError: null,
      })
      .where(eq(imageAssets.assetId, upload.assetId));

    await tx
      .update(uploads)
      .set({
        status: "completed",
        assetId: upload.assetId,
        processingEtag: input.originalEtag,
        errorMessage: null,
        finalizedAt: new Date(),
      })
      .where(and(eq(uploads.id, upload.id)));
  });
}
