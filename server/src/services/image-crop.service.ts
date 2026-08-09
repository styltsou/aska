import { and, asc, eq, isNull, sql } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import {
  assets,
  imageAssets,
  imageEditActions,
  type ImageAssetVariants,
  type StoredImageObjectVariant,
} from "@/db/schema";
import { AppError, ErrorCode } from "@/lib/errors";
import { first } from "@/lib/query";
import type { IObjectStorageService } from "@/services/object-storage.service";

const DISPLAY_WIDTH = 960;
const PREVIEW_WIDTH = 320;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_DECODED_PIXELS = 40_000_000;

type Crop = { x: number; y: number; width: number; height: number };
type EditAction = { id: number; params: unknown };
type QueryClient = Pick<typeof db, "select" | "update">;

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
  ): Promise<{
    image: CroppedImage;
    operationId: number;
    undoableUntil: string;
  }>;
  undo(orgId: string, operationId: number): Promise<{ image: CroppedImage }>;
  redo(orgId: string, operationId: number): Promise<{ image: CroppedImage }>;
}

/** Renders image edits from the immutable uploaded master. */
export class ImageCropService implements IImageCropService {
  constructor(private readonly objectStorageService: IObjectStorageService) {}

  async crop(orgId: string, userId: string, assetNodeId: string, crop: Crop) {
    const assetId = imageAssetId(assetNodeId);
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select 1 from image_assets where asset_id = ${assetId} for update`,
      );
      const row = await this.getImage(orgId, assetId, tx);
      const master = row.variants.master ?? row.variants.original;
      if (!master || row.variantStatus !== "completed") {
        throw new AppError(
          ErrorCode.CONFLICT,
          "This image is still processing or its original is unavailable",
        );
      }
      assertCropInMaster(crop, master.width, master.height);

      // A new edit intentionally drops the redo branch. The log remains ready
      // for multi-step history later without a schema migration.
      await tx
        .delete(imageEditActions)
        .where(
          and(
            eq(imageEditActions.assetId, assetId),
            sql`${imageEditActions.undoneAt} is not null`,
          ),
        );
      const action = first(
        await tx
          .insert(imageEditActions)
          .values({
            organizationId: orgId,
            assetId,
            actionType: "crop",
            params: crop,
            resultWidth: crop.width,
            resultHeight: crop.height,
            createdByUserId: userId,
          })
          .returning({ id: imageEditActions.id }),
      );
      if (!action)
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Could not save crop action",
        );

      const image = await this.renderCurrent(
        orgId,
        assetId,
        row,
        action.id,
        tx,
      );
      return { image, operationId: action.id };
    });

    return {
      ...result,
      undoableUntil: new Date(Date.now() + 10_000).toISOString(),
    };
  }

  async undo(orgId: string, operationId: number) {
    return this.setUndone(orgId, operationId, true);
  }

  async redo(orgId: string, operationId: number) {
    return this.setUndone(orgId, operationId, false);
  }

  private async setUndone(orgId: string, operationId: number, undone: boolean) {
    return db.transaction(async (tx) => {
      const action = first(
        await tx
          .select()
          .from(imageEditActions)
          .where(
            and(
              eq(imageEditActions.id, operationId),
              eq(imageEditActions.organizationId, orgId),
            ),
          )
          .limit(1),
      );
      if (!action)
        throw new AppError(ErrorCode.NOT_FOUND, "Crop operation not found");
      await tx.execute(
        sql`select 1 from image_assets where asset_id = ${action.assetId} for update`,
      );
      const current = await this.getImage(orgId, action.assetId, tx);

      if (undone === (action.undoneAt !== null)) {
        return { image: await this.toImage(current) };
      }
      const latest = first(
        await tx
          .select({ id: imageEditActions.id })
          .from(imageEditActions)
          .where(
            and(
              eq(imageEditActions.assetId, action.assetId),
              isNull(imageEditActions.undoneAt),
            ),
          )
          .orderBy(sql`${imageEditActions.id} desc`)
          .limit(1),
      );
      if (undone && latest?.id !== operationId) {
        throw new AppError(
          ErrorCode.CONFLICT,
          "A newer image edit is already applied",
        );
      }
      await tx
        .update(imageEditActions)
        .set({ undoneAt: undone ? new Date() : null })
        .where(eq(imageEditActions.id, operationId));
      return {
        image: await this.renderCurrent(
          orgId,
          action.assetId,
          current,
          operationId,
          tx,
        ),
      };
    });
  }

  private async renderCurrent(
    orgId: string,
    assetId: number,
    row: Awaited<ReturnType<ImageCropService["getImage"]>>,
    revision: number,
    tx: QueryClient,
  ): Promise<CroppedImage> {
    const master = row.variants.master ?? row.variants.original;
    if (!master)
      throw new AppError(ErrorCode.CONFLICT, "Image original is unavailable");
    const actions = await tx
      .select({ id: imageEditActions.id, params: imageEditActions.params })
      .from(imageEditActions)
      .where(
        and(
          eq(imageEditActions.assetId, assetId),
          isNull(imageEditActions.undoneAt),
        ),
      )
      .orderBy(asc(imageEditActions.id));
    const crop = combinedCrop(actions, master.width, master.height);
    const source = await this.objectStorageService.getObjectBytes(
      master.objectKey,
    );
    if (source.byteLength > MAX_SOURCE_BYTES) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Image source is too large to crop inline",
      );
    }
    const metadata = await sharp(source, {
      limitInputPixels: MAX_DECODED_PIXELS,
    }).metadata();
    if (!metadata.width || !metadata.height)
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Could not decode image original",
      );

    const rendered = sharp(source, {
      limitInputPixels: MAX_DECODED_PIXELS,
    }).extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height,
    });
    const [originalBytes, displayBytes, previewBytes] = await Promise.all([
      rendered.clone().webp({ quality: 90 }).toBuffer(),
      rendered
        .clone()
        .resize(DISPLAY_WIDTH, undefined, { withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
      rendered
        .clone()
        .resize(PREVIEW_WIDTH, undefined, { withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
    ]);
    const prefix = editedPrefix(master.objectKey, revision);
    const output = [
      {
        role: "original" as const,
        variant: objectVariant(
          `${prefix}/original.webp`,
          crop.width,
          crop.height,
          originalBytes,
        ),
        bytes: originalBytes,
      },
      {
        role: "display" as const,
        variant: objectVariant(
          `${prefix}/display.webp`,
          scaledWidth(crop.width, DISPLAY_WIDTH),
          scaledHeight(crop, DISPLAY_WIDTH),
          displayBytes,
        ),
        bytes: displayBytes,
      },
      {
        role: "preview" as const,
        variant: objectVariant(
          `${prefix}/preview.webp`,
          scaledWidth(crop.width, PREVIEW_WIDTH),
          scaledHeight(crop, PREVIEW_WIDTH),
          previewBytes,
        ),
        bytes: previewBytes,
      },
    ];
    const variants: ImageAssetVariants = Object.fromEntries(
      output.map(({ role, variant }) => [role, variant]),
    );
    variants.master = master;
    const writtenKeys: string[] = [];
    try {
      for (const { variant, bytes } of output) {
        await this.objectStorageService.putObject({
          key: variant.objectKey,
          body: bytes,
          contentType: "image/webp",
        });
        writtenKeys.push(variant.objectKey);
      }
      await tx
        .update(imageAssets)
        .set({ variants, width: crop.width, height: crop.height })
        .where(eq(imageAssets.assetId, assetId));
    } catch (error) {
      // A failed write must not leave a partly rendered revision behind.
      await this.objectStorageService
        .deleteObjects(writtenKeys)
        .catch(() => {});
      throw error;
    }
    return this.toImage({
      ...row,
      variants,
      width: crop.width,
      height: crop.height,
    });
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
        })
        .from(assets)
        .innerJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .where(and(eq(assets.id, assetId), eq(assets.organizationId, orgId)))
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
  }) {
    const display = row.variants.display ?? row.variants.original;
    const master = row.variants.master ?? row.variants.original;
    if (!display || !master)
      throw new AppError(ErrorCode.CONFLICT, "Image render is unavailable");
    const [url, originalUrl] = await Promise.all([
      this.objectStorageService.createPresignedGetUrl(display.objectKey),
      this.objectStorageService.createPresignedGetUrl(master.objectKey),
    ]);
    return {
      id: `image-${row.id}`,
      type: "image" as const,
      url: url.url,
      originalUrl: originalUrl.url,
      originalWidth: master.width,
      originalHeight: master.height,
      width: row.width,
      height: row.height,
      title: row.title,
      alt: row.alt,
    };
  }
}

function imageAssetId(id: string): number {
  const value = Number(id.replace(/^image-/, ""));
  if (!Number.isSafeInteger(value) || value < 1)
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid image asset id");
  return value;
}
function assertCropInMaster(crop: Crop, width: number, height: number) {
  if (crop.x + crop.width > width || crop.y + crop.height > height)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Crop must be inside the original image",
    );
}
function combinedCrop(
  actions: EditAction[],
  width: number,
  height: number,
): Crop {
  return actions.reduce<Crop>(
    (current, action) => {
      if (!isCrop(action.params))
        throw new AppError(ErrorCode.CONFLICT, "Unsupported image edit action");
      const x = Math.max(current.x, action.params.x),
        y = Math.max(current.y, action.params.y);
      const right = Math.min(
          current.x + current.width,
          action.params.x + action.params.width,
        ),
        bottom = Math.min(
          current.y + current.height,
          action.params.y + action.params.height,
        );
      if (right <= x || bottom <= y)
        throw new AppError(
          ErrorCode.CONFLICT,
          "Crop does not overlap the current image",
        );
      return { x, y, width: right - x, height: bottom - y };
    },
    { x: 0, y: 0, width, height },
  );
}
function isCrop(value: unknown): value is Crop {
  return (
    typeof value === "object" &&
    value !== null &&
    ["x", "y", "width", "height"].every((key) =>
      Number.isInteger((value as Record<string, unknown>)[key]),
    )
  );
}
function editedPrefix(masterKey: string, revision: number) {
  const parts = masterKey.split("/");
  return `${parts[0]}/${parts[1]}/edited/${revision}`;
}
function objectVariant(
  objectKey: string,
  width: number,
  height: number,
  bytes: Uint8Array,
): StoredImageObjectVariant {
  return {
    objectKey,
    width,
    height,
    contentType: "image/webp",
    sizeBytes: bytes.byteLength,
  };
}
function scaledWidth(width: number, maxWidth: number) {
  return Math.min(width, maxWidth);
}
function scaledHeight(crop: Crop, maxWidth: number) {
  return Math.max(
    1,
    Math.round((crop.height * scaledWidth(crop.width, maxWidth)) / crop.width),
  );
}
