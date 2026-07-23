import { and, eq } from "drizzle-orm";

import { env } from "@/config";
import { db } from "@/db";
import {
  assets,
  collectionNodes,
  imageAssets,
  imageColors,
  uploads,
} from "@/db/schema";
import type { CollectionImageNode } from "@/dto/collection.dto";
import {
  AllowedImageContentTypes as allowedImageContentTypes,
  type CreateImageUploadInput,
  type CreateImageUploadResponse,
  type CreateRemoteImageInput,
  type ImagePipelineCallbackInput,
} from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { first } from "@/lib/query";
import { resolveCollectionTargetBySlug } from "@/services/collection/collection-target-resolver";
import { resolvePipelineCallbackAction } from "@/services/image-upload/callback-state";
import { finalizeImageUpload } from "@/services/image-upload/image-upload-finalizer";
import {
  fileNameFromRemoteImageUrl,
  makeOriginalObjectKey,
  normalizeRemoteImageContentType,
  parseRemoteImageUrl,
} from "@/services/image-upload/remote-image";
import {
  getUploadById,
  getUploadByOriginalObjectKey,
  getUploadForAccess,
  type UploadRecord,
  type UploadStatus,
} from "@/services/image-upload/upload-repository";
import type { IObjectStorageService } from "@/services/object-storage.service";

export type ImageUploadStatus = {
  id: number;
  status: UploadStatus;
  errorMessage: string | null;
  image?: CollectionImageNode;
};

export interface IImageUploadService {
  createDirectImageUpload(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateImageUploadInput,
  ): Promise<CreateImageUploadResponse["upload"]>;
  getDirectImageUploadStatus(
    orgId: string,
    collectionSlug: string,
    uploadId: number,
  ): Promise<ImageUploadStatus>;
  createImageFromRemoteUrl(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateRemoteImageInput,
  ): Promise<ImageUploadStatus>;
  createInboxDirectImageUpload(
    orgId: string,
    userId: string,
    data: CreateImageUploadInput,
  ): Promise<CreateImageUploadResponse["upload"]>;
  getInboxImageUploadStatus(
    orgId: string,
    uploadId: number,
  ): Promise<ImageUploadStatus>;
  createInboxImageFromRemoteUrl(
    orgId: string,
    userId: string,
    data: CreateRemoteImageInput,
  ): Promise<ImageUploadStatus>;
  handlePipelineCallback(
    input: ImagePipelineCallbackInput,
  ): Promise<{ ignored: boolean }>;
}

export class ImageUploadService implements IImageUploadService {
  constructor(private objectStorageService: IObjectStorageService) {}

  async createDirectImageUpload(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateImageUploadInput,
  ): Promise<CreateImageUploadResponse["upload"]> {
    return this.createImageUploadForTarget(orgId, userId, collectionSlug, data);
  }

  async createInboxDirectImageUpload(
    orgId: string,
    userId: string,
    data: CreateImageUploadInput,
  ): Promise<CreateImageUploadResponse["upload"]> {
    return this.createImageUploadForTarget(orgId, userId, null, data);
  }

  private async createImageUploadForTarget(
    orgId: string,
    userId: string,
    collectionSlug: string | null,
    data: CreateImageUploadInput,
  ): Promise<CreateImageUploadResponse["upload"]> {
    const target = await resolveCollectionTargetBySlug(
      orgId,
      collectionSlug,
      data.parentFolderPath,
    );
    const storageId = crypto.randomUUID();
    const objectKey = makeOriginalObjectKey(
      storageId,
      data.fileName,
      data.contentType,
    );
    const presigned = await this.objectStorageService.createPresignedPutUrl({
      key: objectKey,
      contentType: data.contentType,
    });

    const [upload] = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          organizationId: orgId,
          type: "image",
          title: data.title ?? data.fileName,
          createdByUserId: userId,
          updatedByUserId: userId,
          ...(target ? {} : { lastAddedToInboxAt: new Date() }),
        })
        .returning({ id: assets.id });
      if (!asset)
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Failed to create image asset",
        );
      await tx.insert(imageAssets).values({
        assetId: asset.id,
        width: data.width,
        height: data.height,
        alt: data.alt,
        variants: {
          original: {
            objectKey,
            width: data.width,
            height: data.height,
            contentType: data.contentType,
            sizeBytes: data.sizeBytes,
          },
        },
      });
      if (target)
        await tx.insert(collectionNodes).values({
          organizationId: orgId,
          collectionId: target.collection.id,
          parentFolderId: target.parentFolderId,
          nodeType: "asset",
          assetId: asset.id,
          positionX: data.position?.x ?? null,
          positionY: data.position?.y ?? null,
          depth: target.pathFolderSlugs.length,
          pathFolderIds: target.pathFolderIds,
          pathFolderSlugs: target.pathFolderSlugs,
          pathFolderNames: target.pathFolderNames,
        });
      return tx
        .insert(uploads)
        .values({
          organizationId: orgId,
          collectionId: target?.collection.id,
          parentFolderPath: target ? data.parentFolderPath : null,
          positionX: target ? data.position?.x : null,
          positionY: target ? data.position?.y : null,
          source: "direct",
          status: "pending",
          originalObjectKey: objectKey,
          storageId,
          fileName: data.fileName,
          title: data.title,
          alt: data.alt,
          contentType: data.contentType,
          sizeBytes: data.sizeBytes,
          uploadUrlExpiresAt: presigned.expiresAt,
          assetId: asset.id,
          createdByUserId: userId,
        })
        .returning({ id: uploads.id, assetId: uploads.assetId });
    });

    if (!upload) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create upload");
    }

    return {
      id: upload.id,
      objectKey,
      url: presigned.url,
      headers: presigned.headers,
      expiresAt: presigned.expiresAt.toISOString(),
      maxSizeBytes: env.MAX_DIRECT_UPLOAD_BYTES,
      image: await this.getImageNode(upload.assetId!),
    };
  }

  async getDirectImageUploadStatus(
    orgId: string,
    collectionSlug: string,
    uploadId: number,
  ): Promise<ImageUploadStatus> {
    const target = await resolveCollectionTargetBySlug(orgId, collectionSlug);
    const upload = await getUploadForAccess(
      orgId,
      target?.collection.id ?? null,
      uploadId,
    );
    if (!upload) throw new AppError(ErrorCode.NOT_FOUND, "Upload not found");
    return this.toUploadStatus(upload);
  }

  async getInboxImageUploadStatus(
    orgId: string,
    uploadId: number,
  ): Promise<ImageUploadStatus> {
    const upload = await getUploadForAccess(orgId, null, uploadId);
    if (!upload) throw new AppError(ErrorCode.NOT_FOUND, "Upload not found");
    return this.toUploadStatus(upload);
  }

  async createImageFromRemoteUrl(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateRemoteImageInput,
  ): Promise<ImageUploadStatus> {
    return this.createImageFromRemoteUrlForTarget(
      orgId,
      userId,
      collectionSlug,
      data,
    );
  }

  async createInboxImageFromRemoteUrl(
    orgId: string,
    userId: string,
    data: CreateRemoteImageInput,
  ): Promise<ImageUploadStatus> {
    return this.createImageFromRemoteUrlForTarget(orgId, userId, null, data);
  }

  private async createImageFromRemoteUrlForTarget(
    orgId: string,
    userId: string,
    collectionSlug: string | null,
    data: CreateRemoteImageInput,
  ): Promise<ImageUploadStatus> {
    const target = await resolveCollectionTargetBySlug(
      orgId,
      collectionSlug,
      data.parentFolderPath,
    );
    const remoteUrl = parseRemoteImageUrl(data.url);
    const response = await fetch(remoteUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: allowedImageContentTypes.join(",") },
    });
    if (!response.ok) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Remote image request failed with status ${response.status}`,
      );
    }

    const contentType = normalizeRemoteImageContentType(
      response.headers.get("content-type"),
    );
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > env.MAX_DIRECT_UPLOAD_BYTES) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Remote image is too large",
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > env.MAX_DIRECT_UPLOAD_BYTES
    ) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Remote image is invalid or too large",
      );
    }

    const storageId = crypto.randomUUID();
    const fileName = fileNameFromRemoteImageUrl(remoteUrl, contentType);
    const objectKey = makeOriginalObjectKey(storageId, fileName, contentType);
    const [upload] = await db
      .insert(uploads)
      .values({
        organizationId: orgId,
        collectionId: target?.collection.id,
        parentFolderPath: target ? data.parentFolderPath : null,
        positionX: target ? data.position?.x : null,
        positionY: target ? data.position?.y : null,
        source: "remote_url",
        status: "pending",
        originalObjectKey: objectKey,
        storageId,
        fileName,
        title: data.title,
        alt: data.alt,
        sourceLabel: remoteUrl.hostname,
        sourceUrl: remoteUrl.toString(),
        contentType,
        sizeBytes: bytes.byteLength,
        createdByUserId: userId,
      })
      .returning({ id: uploads.id });
    if (!upload)
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Failed to create remote upload",
      );

    // Remote sources are fetched server-side, so dimensions are not available
    // until the worker decodes them. Persist a usable original-backed asset now;
    // the variant callback replaces this provisional 1×1 metadata.
    await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          organizationId: orgId,
          type: "image",
          title: data.title ?? fileName,
          createdByUserId: userId,
          updatedByUserId: userId,
          ...(target ? {} : { lastAddedToInboxAt: new Date() }),
        })
        .returning({ id: assets.id });
      if (!asset)
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Failed to create image asset",
        );
      await tx.insert(imageAssets).values({
        assetId: asset.id,
        width: 1,
        height: 1,
        alt: data.alt,
        sourceLabel: remoteUrl.hostname,
        sourceUrl: remoteUrl.toString(),
        variants: {
          original: {
            objectKey,
            width: 1,
            height: 1,
            contentType,
            sizeBytes: bytes.byteLength,
          },
        },
      });
      if (target)
        await tx.insert(collectionNodes).values({
          organizationId: orgId,
          collectionId: target.collection.id,
          parentFolderId: target.parentFolderId,
          nodeType: "asset",
          assetId: asset.id,
          positionX: data.position?.x ?? null,
          positionY: data.position?.y ?? null,
          depth: target.pathFolderSlugs.length,
          pathFolderIds: target.pathFolderIds,
          pathFolderSlugs: target.pathFolderSlugs,
          pathFolderNames: target.pathFolderNames,
        });
      await tx
        .update(uploads)
        .set({ assetId: asset.id })
        .where(eq(uploads.id, upload.id));
    });

    try {
      await this.objectStorageService.putObject({
        key: objectKey,
        body: bytes,
        contentType,
      });
      await db
        .update(uploads)
        .set({ status: "uploaded" })
        .where(and(eq(uploads.id, upload.id), eq(uploads.status, "pending")));
    } catch (error) {
      await db
        .update(uploads)
        .set({
          status: "failed",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unable to store remote image",
        })
        .where(eq(uploads.id, upload.id));
      throw error;
    }

    return this.getUploadStatusById(upload.id);
  }

  async handlePipelineCallback(
    input: ImagePipelineCallbackInput,
  ): Promise<{ ignored: boolean }> {
    const upload = await getUploadByOriginalObjectKey(input.originalObjectKey);
    const action = resolvePipelineCallbackAction(upload, input);
    if (action.type === "ignore") return { ignored: action.ignored };
    if (!upload) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Pipeline callback action requires an upload",
      );
    }

    if (action.type === "mark-processing") {
      await db
        .update(uploads)
        .set({
          status: "processing",
          processingEtag: input.originalEtag,
          errorMessage: null,
        })
        .where(eq(uploads.id, upload.id));
      return { ignored: false };
    }

    if (
      action.type === "mark-failed" &&
      (input.event === "image.variants.failed" ||
        input.event === "image.palette.failed")
    ) {
      await db.transaction(async (tx) => {
        await tx
          .update(uploads)
          .set({
            status:
              input.event === "image.variants.failed"
                ? "failed"
                : upload.status,
            processingEtag: input.originalEtag,
            errorMessage: input.error,
          })
          .where(eq(uploads.id, upload.id));
        if (upload.assetId)
          await tx
            .update(imageAssets)
            .set({
              ...(input.event === "image.variants.failed"
                ? { variantStatus: "failed", variantError: input.error }
                : { paletteStatus: "failed", paletteError: input.error }),
            })
            .where(eq(imageAssets.assetId, upload.assetId));
      });
      return { ignored: false };
    }

    if (input.event === "image.palette.completed") {
      await this.applyPaletteResult(upload, input);
      return { ignored: false };
    }
    if (input.event !== "image.variants.completed") {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Pipeline callback action does not match its status",
      );
    }

    await finalizeImageUpload(upload, input);
    return { ignored: false };
  }

  private async getUploadStatusById(
    uploadId: number,
  ): Promise<ImageUploadStatus> {
    const upload = await getUploadById(uploadId);
    if (!upload) throw new AppError(ErrorCode.NOT_FOUND, "Upload not found");
    return this.toUploadStatus(upload);
  }

  private async toUploadStatus(
    upload: UploadRecord,
  ): Promise<ImageUploadStatus> {
    return {
      id: upload.id,
      status: upload.status,
      errorMessage: upload.errorMessage,
      ...(upload.status === "completed" && upload.assetId
        ? {
            image: {
              ...(await this.getImageNode(upload.assetId)),
              position:
                upload.positionX === null || upload.positionY === null
                  ? null
                  : { x: upload.positionX, y: upload.positionY },
            },
          }
        : {}),
    };
  }

  private async getImageNode(assetId: number): Promise<CollectionImageNode> {
    const row = first(
      await db
        .select({
          assetId: assets.id,
          title: assets.title,
          isFavorite: assets.isFavorite,
          createdAt: assets.createdAt,
          width: imageAssets.width,
          height: imageAssets.height,
          alt: imageAssets.alt,
          sourceLabel: imageAssets.sourceLabel,
          sourceUrl: imageAssets.sourceUrl,
          variants: imageAssets.variants,
          blurDataURL: imageAssets.blurDataURL,
          dominantColors: imageAssets.dominantColors,
          variantStatus: imageAssets.variantStatus,
          paletteStatus: imageAssets.paletteStatus,
        })
        .from(assets)
        .innerJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .where(eq(assets.id, assetId))
        .limit(1),
    );
    const preferred = row?.variants.display ?? row?.variants.original;
    if (!row || !preferred?.objectKey)
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "Image display variant not found",
      );
    const [display, original] = await Promise.all([
      this.objectStorageService.createPresignedGetUrl(preferred.objectKey),
      row.variants.original?.objectKey
        ? this.objectStorageService.createPresignedGetUrl(
            row.variants.original.objectKey,
          )
        : undefined,
    ]);
    return {
      id: `image-${row.assetId}`,
      type: "image",
      url: display.url,
      originalUrl: original?.url,
      originalWidth: row.variants.original?.width,
      originalHeight: row.variants.original?.height,
      width: preferred.width,
      height: preferred.height,
      title: row.title,
      alt: row.alt,
      sourceLabel: row.sourceLabel,
      sourceUrl: row.sourceUrl,
      isFavorite: row.isFavorite,
      blurDataURL: row.blurDataURL,
      dominantColors: row.dominantColors,
      variantStatus: row.variantStatus,
      paletteStatus: row.paletteStatus,
      sizeBytes: preferred.sizeBytes,
      createdAt: row.createdAt.toISOString(),
      position: null,
    };
  }

  private async applyPaletteResult(
    upload: UploadRecord,
    input: Extract<
      ImagePipelineCallbackInput,
      { event: "image.palette.completed" }
    >,
  ): Promise<void> {
    if (!upload.assetId) return;
    await db.transaction(async (tx) => {
      await tx
        .delete(imageColors)
        .where(eq(imageColors.assetId, upload.assetId!));
      if (input.palette.length)
        await tx.insert(imageColors).values(
          input.palette.map((color) => ({
            ...color,
            organizationId: upload.organizationId,
            assetId: upload.assetId!,
            extractionVersion: input.extractionVersion,
          })),
        );
      await tx
        .update(imageAssets)
        .set({
          dominantColors: input.palette.map((color) => color.hex),
          paletteStatus: "completed",
          paletteError: null,
        })
        .where(eq(imageAssets.assetId, upload.assetId!));
    });
  }
}
