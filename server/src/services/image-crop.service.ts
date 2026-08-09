import { and, desc, eq, sql } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import {
  assets,
  imageAssets,
  imageColors,
  mediaCleanupJobs,
  uploads,
  type ImageAssetVariants,
  type StoredImageObjectVariant,
} from "@/db/schema";
import { AppError, ErrorCode } from "@/lib/errors";
import { first } from "@/lib/query";
import { makeOriginalObjectKey } from "@/services/image-upload/remote-image";
import type { IObjectStorageService } from "@/services/object-storage.service";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_DECODED_PIXELS = 40_000_000;

type Crop = { x: number; y: number; width: number; height: number };
type QueryClient = Pick<
  typeof db,
  "delete" | "execute" | "insert" | "select" | "update"
>;

export type CroppedImage = {
  id: string;
  type: "image";
  url: string;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  title: string | null;
  alt: string | null;
};

export interface IImageCropService {
  crop(
    orgId: string,
    userId: string,
    assetNodeId: string,
    crop: Crop,
  ): Promise<{ image: CroppedImage }>;
}

/**
 * Replaces an image source in place. The new cropped original uses a fresh
 * storage ID, then the normal upload workers regenerate its variants/palette.
 */
export class ImageCropService implements IImageCropService {
  constructor(private readonly objectStorageService: IObjectStorageService) {}

  async crop(orgId: string, userId: string, assetNodeId: string, crop: Crop) {
    const assetId = imageAssetId(assetNodeId);
    const initial = await this.getImage(orgId, assetId, db);
    this.assertReadyForCrop(initial, crop);

    const originalBytes = await this.renderCroppedOriginal(
      initial.variants.original!,
      crop,
    );
    const storageId = crypto.randomUUID();
    const originalObjectKey = makeOriginalObjectKey(
      orgId,
      storageId,
      "cropped.webp",
      "image/webp",
    );
    const original: StoredImageObjectVariant = {
      objectKey: originalObjectKey,
      width: crop.width,
      height: crop.height,
      contentType: "image/webp",
      sizeBytes: originalBytes.byteLength,
    };

    // S3 is not part of Postgres's transaction. Write the new immutable source
    // first; if the DB switch fails, immediately remove this otherwise-orphan.
    await this.objectStorageService.putObject({
      key: originalObjectKey,
      body: originalBytes,
      contentType: "image/webp",
    });

    try {
      const image = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select 1 from image_assets where asset_id = ${assetId} for update`,
        );
        const current = await this.getImage(orgId, assetId, tx);
        this.assertReadyForCrop(current, crop);
        if (
          current.variants.original?.objectKey !==
            initial.variants.original?.objectKey ||
          current.upload.originalObjectKey !== initial.upload.originalObjectKey
        ) {
          throw new AppError(
            ErrorCode.CONFLICT,
            "This image was changed before the crop could be applied",
          );
        }

        const priorKeys = collectVariantKeys(current.variants);
        if (!priorKeys.includes(current.upload.originalObjectKey)) {
          priorKeys.push(current.upload.originalObjectKey);
        }
        const variants: ImageAssetVariants = { original };

        await tx
          .update(assets)
          .set({ updatedByUserId: userId })
          .where(eq(assets.id, assetId));
        await tx.delete(imageColors).where(eq(imageColors.assetId, assetId));
        await tx
          .update(imageAssets)
          .set({
            variants,
            width: crop.width,
            height: crop.height,
            blurDataURL: null,
            dominantColors: [],
            variantStatus: "processing",
            paletteStatus: "processing",
            variantError: null,
            paletteError: null,
          })
          .where(eq(imageAssets.assetId, assetId));
        await tx
          .update(uploads)
          .set({
            status: "uploaded",
            originalObjectKey,
            storageId,
            fileName: "cropped.webp",
            contentType: "image/webp",
            sizeBytes: originalBytes.byteLength,
            uploadUrlExpiresAt: null,
            processingEtag: null,
            errorMessage: null,
            finalizedAt: null,
          })
          .where(eq(uploads.id, current.upload.id));
        if (priorKeys.length > 0) {
          await tx.insert(mediaCleanupJobs).values({
            organizationId: orgId,
            assetId,
            objectKeys: priorKeys,
          });
        }

        return this.toImage({ ...current, variants, original });
      });
      return { image };
    } catch (error) {
      await this.objectStorageService
        .deleteObject(originalObjectKey)
        .catch(() => {});
      throw error;
    }
  }

  private async renderCroppedOriginal(
    source: StoredImageObjectVariant,
    crop: Crop,
  ) {
    const sourceBytes = await this.objectStorageService.getObjectBytes(
      source.objectKey,
    );
    if (sourceBytes.byteLength > MAX_SOURCE_BYTES) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Image source is too large to crop inline",
      );
    }
    return sharp(sourceBytes, { limitInputPixels: MAX_DECODED_PIXELS })
      .extract({
        left: crop.x,
        top: crop.y,
        width: crop.width,
        height: crop.height,
      })
      .webp({ quality: 90 })
      .toBuffer();
  }

  private assertReadyForCrop(
    row: Awaited<ReturnType<ImageCropService["getImage"]>>,
    crop: Crop,
  ) {
    if (!row.variants.original || row.variantStatus !== "completed") {
      throw new AppError(
        ErrorCode.CONFLICT,
        "This image is still processing or its source is unavailable",
      );
    }
    assertCropInSource(crop, row.width, row.height);
  }

  private async getImage(orgId: string, assetId: number, client: QueryClient) {
    const row = first(
      await client
        .select({
          id: assets.id,
          title: assets.title,
          width: imageAssets.width,
          height: imageAssets.height,
          alt: imageAssets.alt,
          variants: imageAssets.variants,
          variantStatus: imageAssets.variantStatus,
          upload: {
            id: uploads.id,
            originalObjectKey: uploads.originalObjectKey,
          },
        })
        .from(assets)
        .innerJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .innerJoin(uploads, eq(uploads.assetId, assets.id))
        .where(and(eq(assets.id, assetId), eq(assets.organizationId, orgId)))
        .orderBy(desc(uploads.updatedAt))
        .limit(1),
    );
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Image asset not found");
    return row;
  }

  private async toImage(row: {
    id: number;
    title: string | null;
    width: number;
    height: number;
    alt: string | null;
    variants: ImageAssetVariants;
    original: StoredImageObjectVariant;
  }) {
    const originalUrl = await this.objectStorageService.createPresignedGetUrl(
      row.original.objectKey,
    );
    return {
      id: `image-${row.id}`,
      type: "image" as const,
      url: originalUrl.url,
      originalUrl: originalUrl.url,
      originalWidth: row.width,
      originalHeight: row.height,
      width: row.width,
      height: row.height,
      title: row.title,
      alt: row.alt,
    };
  }
}

function imageAssetId(id: string): number {
  const value = Number(id.replace(/^image-/, ""));
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid image asset id");
  }
  return value;
}

function assertCropInSource(crop: Crop, width: number, height: number) {
  if (
    !Number.isInteger(crop.x) ||
    !Number.isInteger(crop.y) ||
    !Number.isInteger(crop.width) ||
    !Number.isInteger(crop.height) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width < 1 ||
    crop.height < 1 ||
    crop.x + crop.width > width ||
    crop.y + crop.height > height
  ) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Crop must be a positive integer rectangle inside the current image",
    );
  }
}

function collectVariantKeys(variants: ImageAssetVariants): string[] {
  return [
    ...new Set(
      Object.values(
        variants as Record<string, StoredImageObjectVariant | undefined>,
      )
        .map((variant) => variant?.objectKey)
        .filter((key): key is string => key !== undefined),
    ),
  ];
}
