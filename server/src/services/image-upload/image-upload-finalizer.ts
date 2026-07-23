import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  imageAssets,
  imageColors,
  uploads,
} from "@/db/schema";
import type { ImagePipelineCallbackInput } from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { first } from "@/lib/query";
import { resolveCollectionTargetById } from "@/services/collection/collection-target-resolver";
import {
  toStoredImageVariants,
  validateCompletedPipelineResult,
} from "@/services/image-upload/pipeline-result";
import type { UploadRecord } from "@/services/image-upload/upload-repository";

type CompletedPipelineResult = Extract<
  ImagePipelineCallbackInput,
  { status: "completed" }
>;

/** Atomically persists a completed pipeline result and its collection placement. */
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

    const [insertedAsset] = await tx
      .insert(assets)
      .values({
        organizationId: upload.organizationId,
        type: "image",
        title: upload.title,
        createdByUserId: upload.createdByUserId,
        updatedByUserId: upload.createdByUserId,
      })
      .returning();
    if (!insertedAsset) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Failed to create image asset",
      );
    }

    const variants = toStoredImageVariants(upload, input);
    await tx.insert(imageAssets).values({
      assetId: insertedAsset.id,
      width: input.width,
      height: input.height,
      alt: upload.alt,
      sourceLabel: upload.sourceLabel,
      sourceUrl: upload.sourceUrl,
      variants,
      blurDataURL: input.blurDataURL,
      dominantColors: input.palette.map((color) => color.hex),
    });

    if (input.palette.length > 0) {
      await tx.insert(imageColors).values(
        input.palette.map((color) => ({
          organizationId: upload.organizationId,
          assetId: insertedAsset.id,
          hex: color.hex,
          oklabL: color.oklabL,
          oklabA: color.oklabA,
          oklabB: color.oklabB,
          coverage: color.coverage,
          salience: color.salience,
          isAccent: color.isAccent,
          extractionVersion: input.extractionVersion,
        })),
      );
    }

    const target = await resolveCollectionTargetById(
      upload.organizationId,
      upload.collectionId,
      upload.parentFolderPath ?? undefined,
    );
    if (target) {
      await tx.insert(collectionNodes).values({
        organizationId: upload.organizationId,
        collectionId: target.collection.id,
        parentFolderId: target.parentFolderId,
        nodeType: "asset",
        assetId: insertedAsset.id,
        positionX: upload.positionX,
        positionY: upload.positionY,
        depth: target.pathFolderSlugs.length,
        pathFolderIds: target.pathFolderIds,
        pathFolderSlugs: target.pathFolderSlugs,
        pathFolderNames: target.pathFolderNames,
      });
    } else {
      await tx
        .update(assets)
        .set({ lastAddedToInboxAt: new Date() })
        .where(eq(assets.id, insertedAsset.id));
    }

    await tx
      .update(uploads)
      .set({
        status: "completed",
        assetId: insertedAsset.id,
        processingEtag: input.originalEtag,
        errorMessage: null,
        finalizedAt: new Date(),
      })
      .where(and(eq(uploads.id, upload.id)));
  });
}
