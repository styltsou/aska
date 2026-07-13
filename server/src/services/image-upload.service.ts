import { and, eq, isNull } from "drizzle-orm";

import { env } from "@/config";
import { db } from "@/db";
import {
  assets,
  collectionNodes,
  collectionsTable,
  imageAssets,
  imageColors,
  uploads,
  type ImageAssetVariants,
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
import type { IObjectStorageService } from "@/services/object-storage.service";

type ResolvedCollectionTarget = {
  collection: { id: number; slug: string };
  parentFolderId: number | null;
  pathFolderIds: number[];
  pathFolderSlugs: string[];
  pathFolderNames: string[];
};

type UploadStatus =
  | "pending"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";

type UploadRecord = {
  id: number;
  organizationId: string;
  collectionId: number | null;
  parentFolderPath: string | null;
  source: "direct" | "remote_url";
  status: UploadStatus;
  originalObjectKey: string;
  storageId: string;
  assetId: number | null;
  fileName: string | null;
  title: string | null;
  alt: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  contentType: string;
  sizeBytes: number;
  processingEtag: string | null;
  errorMessage: string | null;
  createdByUserId: string | null;
};

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
    const target = await this.resolveCollectionTarget(
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

    const [upload] = await db
      .insert(uploads)
      .values({
        organizationId: orgId,
        collectionId: target?.collection.id,
        parentFolderPath: target ? data.parentFolderPath : null,
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
        createdByUserId: userId,
      })
      .returning({ id: uploads.id });

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
    };
  }

  async getDirectImageUploadStatus(
    orgId: string,
    collectionSlug: string,
    uploadId: number,
  ): Promise<ImageUploadStatus> {
    const target = await this.resolveCollectionTarget(orgId, collectionSlug);
    const upload = await this.getUploadForAccess(
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
    const upload = await this.getUploadForAccess(orgId, null, uploadId);
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
    const target = await this.resolveCollectionTarget(
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

    const contentType = normalizeImageContentType(
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
    const fileName = fileNameFromRemoteUrl(remoteUrl, contentType);
    const objectKey = makeOriginalObjectKey(storageId, fileName, contentType);
    const [upload] = await db
      .insert(uploads)
      .values({
        organizationId: orgId,
        collectionId: target?.collection.id,
        parentFolderPath: target ? data.parentFolderPath : null,
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
    const upload = await this.getUploadByOriginalObjectKey(
      input.originalObjectKey,
    );
    if (!upload || !input.originalObjectKey.startsWith("ingest/"))
      return { ignored: true };
    if (upload.processingEtag && upload.processingEtag !== input.originalEtag)
      return { ignored: true };
    if (upload.status === "completed") return { ignored: false };
    if (upload.status === "failed") return { ignored: true };

    if (input.status === "processing") {
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

    if (input.status === "failed") {
      await db
        .update(uploads)
        .set({
          status: "failed",
          processingEtag: input.originalEtag,
          errorMessage: input.error,
        })
        .where(eq(uploads.id, upload.id));
      return { ignored: false };
    }

    validatePipelineResult(upload, input);
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
      if (current.status === "failed")
        throw new AppError(ErrorCode.CONFLICT, "Upload is already failed");
      if (
        current.processingEtag &&
        current.processingEtag !== input.originalEtag
      )
        return;

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
      if (!insertedAsset)
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Failed to create image asset",
        );

      const variants = toStoredVariants(upload, input);
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

      const target = await this.resolveStoredTarget(upload);
      if (target) {
        await tx.insert(collectionNodes).values({
          organizationId: upload.organizationId,
          collectionId: target.collection.id,
          parentFolderId: target.parentFolderId,
          nodeType: "asset",
          assetId: insertedAsset.id,
          sortKey: makeSortKey(),
          depth: target.pathFolderSlugs.length,
          pathFolderIds: target.pathFolderIds,
          pathFolderSlugs: target.pathFolderSlugs,
          pathFolderNames: target.pathFolderNames,
        });
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
        .where(eq(uploads.id, upload.id));
    });
    return { ignored: false };
  }

  private async getUploadStatusById(
    uploadId: number,
  ): Promise<ImageUploadStatus> {
    const upload = await this.getUploadById(uploadId);
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
        ? { image: await this.getImageNode(upload.assetId) }
        : {}),
    };
  }

  private async getUploadForAccess(
    orgId: string,
    collectionId: number | null,
    uploadId: number,
  ): Promise<UploadRecord | undefined> {
    return (
      first(
        await db
          .select(uploadSelection)
          .from(uploads)
          .where(
            and(
              eq(uploads.id, uploadId),
              eq(uploads.organizationId, orgId),
              collectionId === null
                ? isNull(uploads.collectionId)
                : eq(uploads.collectionId, collectionId),
            ),
          )
          .limit(1),
      ) ?? undefined
    );
  }

  private async getUploadById(
    uploadId: number,
  ): Promise<UploadRecord | undefined> {
    return (
      first(
        await db
          .select(uploadSelection)
          .from(uploads)
          .where(eq(uploads.id, uploadId))
          .limit(1),
      ) ?? undefined
    );
  }

  private async getUploadByOriginalObjectKey(
    objectKey: string,
  ): Promise<UploadRecord | undefined> {
    return (
      first(
        await db
          .select(uploadSelection)
          .from(uploads)
          .where(eq(uploads.originalObjectKey, objectKey))
          .limit(1),
      ) ?? undefined
    );
  }

  private async resolveCollectionTarget(
    orgId: string,
    collectionSlug: string | null,
    folderPath?: string,
  ): Promise<ResolvedCollectionTarget | null> {
    if (!collectionSlug) return null;
    const collection = first(
      await db
        .select({ id: collectionsTable.id, slug: collectionsTable.slug })
        .from(collectionsTable)
        .where(
          and(
            eq(collectionsTable.organizationId, orgId),
            eq(collectionsTable.slug, collectionSlug),
          ),
        )
        .limit(1),
    );
    if (!collection)
      throw new AppError(ErrorCode.NOT_FOUND, "Collection not found");
    return this.resolveTargetInCollection(collection, folderPath);
  }

  private async resolveStoredTarget(
    upload: UploadRecord,
  ): Promise<ResolvedCollectionTarget | null> {
    if (!upload.collectionId) return null;
    const collection = first(
      await db
        .select({ id: collectionsTable.id, slug: collectionsTable.slug })
        .from(collectionsTable)
        .where(
          and(
            eq(collectionsTable.id, upload.collectionId),
            eq(collectionsTable.organizationId, upload.organizationId),
          ),
        )
        .limit(1),
    );
    if (!collection)
      throw new AppError(ErrorCode.NOT_FOUND, "Collection no longer exists");
    return this.resolveTargetInCollection(
      collection,
      upload.parentFolderPath ?? undefined,
    );
  }

  private async resolveTargetInCollection(
    collection: ResolvedCollectionTarget["collection"],
    folderPath?: string,
  ): Promise<ResolvedCollectionTarget> {
    const pathFolderSlugs = folderPath?.split("/").filter(Boolean) ?? [];
    if (pathFolderSlugs.length === 0) {
      return {
        collection,
        parentFolderId: null,
        pathFolderIds: [],
        pathFolderSlugs: [],
        pathFolderNames: [],
      };
    }
    const folderNode = first(
      await db
        .select({
          folderId: collectionNodes.folderId,
          pathFolderIds: collectionNodes.pathFolderIds,
          pathFolderSlugs: collectionNodes.pathFolderSlugs,
          pathFolderNames: collectionNodes.pathFolderNames,
        })
        .from(collectionNodes)
        .where(
          and(
            eq(collectionNodes.collectionId, collection.id),
            eq(collectionNodes.pathFolderSlugs, pathFolderSlugs),
            eq(collectionNodes.nodeType, "folder"),
          ),
        )
        .limit(1),
    );
    if (!folderNode?.folderId)
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "Parent folder not found in collection",
      );
    return { collection, parentFolderId: folderNode.folderId, ...folderNode };
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
        })
        .from(assets)
        .innerJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .where(eq(assets.id, assetId))
        .limit(1),
    );
    if (!row?.variants.display?.objectKey)
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "Image display variant not found",
      );
    const [display, original] = await Promise.all([
      this.objectStorageService.createPresignedGetUrl(
        row.variants.display.objectKey,
      ),
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
      width: row.variants.display.width,
      height: row.variants.display.height,
      title: row.title,
      alt: row.alt,
      sourceLabel: row.sourceLabel,
      sourceUrl: row.sourceUrl,
      isFavorite: row.isFavorite,
      blurDataURL: row.blurDataURL,
      dominantColors: row.dominantColors,
      sizeBytes: row.variants.display.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

const uploadSelection = {
  id: uploads.id,
  organizationId: uploads.organizationId,
  collectionId: uploads.collectionId,
  parentFolderPath: uploads.parentFolderPath,
  source: uploads.source,
  status: uploads.status,
  originalObjectKey: uploads.originalObjectKey,
  storageId: uploads.storageId,
  assetId: uploads.assetId,
  fileName: uploads.fileName,
  title: uploads.title,
  alt: uploads.alt,
  sourceLabel: uploads.sourceLabel,
  sourceUrl: uploads.sourceUrl,
  contentType: uploads.contentType,
  sizeBytes: uploads.sizeBytes,
  processingEtag: uploads.processingEtag,
  errorMessage: uploads.errorMessage,
  createdByUserId: uploads.createdByUserId,
} as const;

function validatePipelineResult(
  upload: UploadRecord,
  input: Extract<ImagePipelineCallbackInput, { status: "completed" }>,
): void {
  const expectedRoles = new Set(input.variants.map((variant) => variant.role));
  if (
    expectedRoles.size !== 2 ||
    !expectedRoles.has("display") ||
    !expectedRoles.has("preview")
  ) {
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

function toStoredVariants(
  upload: UploadRecord,
  input: Extract<ImagePipelineCallbackInput, { status: "completed" }>,
): ImageAssetVariants {
  const variants = Object.fromEntries(
    input.variants.map((variant) => [variant.role, variant]),
  );
  const display = variants.display!;
  const preview = variants.preview!;
  return {
    original: {
      objectKey: upload.originalObjectKey,
      width: input.width,
      height: input.height,
      contentType: upload.contentType,
      sizeBytes: upload.sizeBytes,
    },
    display,
    preview,
  };
}

function makeOriginalObjectKey(
  storageId: string,
  fileName: string,
  contentType: string,
): string {
  return `ingest/${storageId}/original${extensionForImage(fileName, contentType)}`;
}

function makeVariantObjectKey(
  storageId: string,
  role: "display" | "preview",
): string {
  return `assets/${storageId}/${role}.webp`;
}

function extensionForImage(fileName: string, contentType: string): string {
  const fileExt = fileName
    .trim()
    .toLowerCase()
    .match(/\.[a-z0-9]+$/)?.[0];
  if (fileExt && fileExt.length <= 12)
    return fileExt === ".jpeg" ? ".jpg" : fileExt;
  return (
    (
      {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
      } as Record<string, string>
    )[contentType] ?? ""
  );
}

function makeSortKey(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

function parseRemoteImageUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Remote image URL must use HTTP or HTTPS",
    );
  }
  return url;
}

function normalizeImageContentType(contentTypeHeader: string | null): string {
  const contentType = contentTypeHeader?.split(";")[0]?.trim().toLowerCase();
  if (
    !contentType ||
    !allowedImageContentTypes.includes(
      contentType as (typeof allowedImageContentTypes)[number],
    )
  ) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Remote URL did not return a supported image type",
    );
  }
  return contentType;
}

function fileNameFromRemoteUrl(url: URL, contentType: string): string {
  const pathName = url.pathname.split("/").filter(Boolean).at(-1);
  if (pathName) return pathName;
  const extension =
    (
      {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      } as Record<string, string>
    )[contentType] ?? "img";
  return `remote-image.${extension}`;
}
