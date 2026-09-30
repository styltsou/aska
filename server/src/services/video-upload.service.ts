import { and, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  videoAssets,
  videoUploads,
} from "@/db/schema";
import {
  MAX_VIDEO_UPLOAD_BYTES,
  type CreateRemoteVideoInput,
  type CreateVideoUploadInput,
  type VideoPipelineCallbackInput,
} from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { resolveCollectionTargetBySlug } from "@/services/collection/collection-target-resolver";
import type { IObjectStorageService } from "@/services/object-storage.service";
import { TaskQueueService } from "@/services/task-queue.service";

export type VideoUploadStatus = {
  id: number;
  status: "pending" | "uploaded" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  assetId: string;
};

export class VideoUploadService {
  constructor(
    private readonly storage: IObjectStorageService,
    private readonly queue = new TaskQueueService(),
  ) {}

  async createDirect(
    orgId: string,
    userId: string,
    collectionSlug: string | null,
    data: CreateVideoUploadInput,
  ) {
    const target = await resolveCollectionTargetBySlug(
      orgId,
      collectionSlug,
      data.parentFolderPath,
    );
    const storageId = crypto.randomUUID();
    const ext = data.contentType === "video/mp4" ? "mp4" : "webm";
    const objectKey = `${orgId}/video/${storageId}/original.${ext}`;
    const put = await this.storage.createPresignedPutUrl({
      key: objectKey,
      contentType: data.contentType,
    });
    const { id } = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          organizationId: orgId,
          type: "video",
          title: data.title ?? data.fileName,
          createdByUserId: userId,
          updatedByUserId: userId,
          ...(target ? {} : { lastAddedToInboxAt: new Date() }),
        })
        .returning({ id: assets.id });
      if (!asset)
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Unable to create video");
      await tx.insert(videoAssets).values({ assetId: asset.id });
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
      const [upload] = await tx
        .insert(videoUploads)
        .values({
          organizationId: orgId,
          collectionId: target?.collection.id,
          parentFolderPath: target ? data.parentFolderPath : null,
          positionX: target ? data.position?.x : null,
          positionY: target ? data.position?.y : null,
          source: "direct",
          originalObjectKey: objectKey,
          storageId,
          assetId: asset.id,
          fileName: data.fileName,
          title: data.title,
          contentType: data.contentType,
          sizeBytes: data.sizeBytes,
          uploadUrlExpiresAt: put.expiresAt,
          createdByUserId: userId,
        })
        .returning({ id: videoUploads.id });
      if (!upload)
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Unable to create video upload",
        );
      return upload;
    });
    return {
      id,
      objectKey,
      url: put.url,
      headers: put.headers,
      expiresAt: put.expiresAt.toISOString(),
      maxSizeBytes: MAX_VIDEO_UPLOAD_BYTES,
    };
  }

  async createRemote(
    orgId: string,
    userId: string,
    collectionSlug: string | null,
    data: CreateRemoteVideoInput,
  ): Promise<VideoUploadStatus> {
    const target = await resolveCollectionTargetBySlug(
      orgId,
      collectionSlug,
      data.parentFolderPath,
    );
    const url = new URL(data.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Enter a public HTTP(S) video URL",
      );
    const storageId = crypto.randomUUID();
    const fileName = (
      url.pathname.split("/").filter(Boolean).at(-1) || "remote-video"
    ).slice(0, 255);
    const row = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          organizationId: orgId,
          type: "video",
          title: data.title ?? fileName,
          createdByUserId: userId,
          updatedByUserId: userId,
          ...(target ? {} : { lastAddedToInboxAt: new Date() }),
        })
        .returning({ id: assets.id });
      if (!asset)
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Unable to create video");
      await tx.insert(videoAssets).values({
        assetId: asset.id,
        sourceLabel: url.hostname.slice(0, 120),
        sourceUrl: url.toString(),
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
      const [upload] = await tx
        .insert(videoUploads)
        .values({
          organizationId: orgId,
          collectionId: target?.collection.id,
          parentFolderPath: target ? data.parentFolderPath : null,
          positionX: target ? data.position?.x : null,
          positionY: target ? data.position?.y : null,
          source: "remote_url",
          storageId,
          assetId: asset.id,
          fileName,
          title: data.title,
          sourceUrl: url.toString(),
          createdByUserId: userId,
        })
        .returning({ id: videoUploads.id });
      if (!upload)
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Unable to queue video import",
        );
      return { id: upload.id, assetId: asset.id };
    });
    try {
      if (!(await this.queue.enqueueRemoteVideo(row.id)))
        throw new Error("Video import queue unavailable");
    } catch {
      await this.failUpload(
        row.id,
        row.assetId,
        "Unable to start video import",
      );
    }
    return this.status(orgId, collectionSlug, row.id);
  }

  async status(
    orgId: string,
    collectionSlug: string | null,
    id: number,
  ): Promise<VideoUploadStatus> {
    const target = collectionSlug
      ? await resolveCollectionTargetBySlug(orgId, collectionSlug)
      : null;
    const [row] = await db
      .select()
      .from(videoUploads)
      .where(
        and(
          eq(videoUploads.id, id),
          eq(videoUploads.organizationId, orgId),
          target
            ? eq(videoUploads.collectionId, target.collection.id)
            : isNull(videoUploads.collectionId),
        ),
      )
      .limit(1);
    if (!row || !row.assetId)
      throw new AppError(ErrorCode.NOT_FOUND, "Video upload not found");
    return {
      id: row.id,
      status: row.status,
      errorMessage: row.errorMessage,
      assetId: `video-${row.assetId}`,
    };
  }

  async markClientFailure(
    orgId: string,
    collectionSlug: string | null,
    id: number,
  ): Promise<VideoUploadStatus> {
    const existing = await this.status(orgId, collectionSlug, id);
    if (existing.status === "pending")
      await this.failUpload(
        id,
        Number(existing.assetId.slice(6)),
        "Upload failed",
      );
    return this.status(orgId, collectionSlug, id);
  }

  async expireStale(): Promise<number> {
    const now = new Date();
    const stale = await db
      .select({ id: videoUploads.id, assetId: videoUploads.assetId })
      .from(videoUploads)
      .where(
        and(
          or(
            eq(videoUploads.status, "pending"),
            eq(videoUploads.status, "uploaded"),
            eq(videoUploads.status, "processing"),
          ),
          or(
            lt(videoUploads.createdAt, new Date(now.getTime() - 60 * 60_000)),
            and(
              eq(videoUploads.source, "direct"),
              eq(videoUploads.status, "pending"),
              lt(videoUploads.uploadUrlExpiresAt, now),
            ),
          ),
        ),
      );
    for (const row of stale)
      if (row.assetId)
        await this.failUpload(
          row.id,
          row.assetId,
          "Video processing timed out",
        );
    return stale.length;
  }

  async getRemoteClaim(uploadId: number) {
    const [row] = await db
      .select()
      .from(videoUploads)
      .where(eq(videoUploads.id, uploadId))
      .limit(1);
    if (
      !row ||
      row.source !== "remote_url" ||
      !row.sourceUrl ||
      !row.assetId ||
      row.status === "failed" ||
      row.status === "completed"
    )
      return { ignored: true as const };
    return {
      ignored: false as const,
      url: row.sourceUrl,
      organizationId: row.organizationId,
      storageId: row.storageId,
      originalObjectKey: row.originalObjectKey,
    };
  }

  async handleCallback(
    input: VideoPipelineCallbackInput,
  ): Promise<{ ignored: boolean }> {
    if (input.event === "video.import.failed") {
      const [row] = await db
        .select()
        .from(videoUploads)
        .where(eq(videoUploads.id, input.uploadId))
        .limit(1);
      if (
        !row?.assetId ||
        row.status === "completed" ||
        row.status === "failed"
      )
        return { ignored: true };
      await this.failUpload(row.id, row.assetId, input.error);
      return { ignored: false };
    }
    if (input.event === "video.import.ready") {
      const [row] = await db
        .select()
        .from(videoUploads)
        .where(eq(videoUploads.id, input.uploadId))
        .limit(1);
      if (
        !row ||
        !row.assetId ||
        row.source !== "remote_url" ||
        row.status === "failed" ||
        row.status === "completed"
      )
        return { ignored: true };
      const ext = input.contentType === "video/mp4" ? "mp4" : "webm";
      if (
        input.originalObjectKey !==
        `${row.organizationId}/video/${row.storageId}/original.${ext}`
      )
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Invalid video object key",
        );
      await db.transaction(async (tx) => {
        await tx
          .update(videoUploads)
          .set({
            originalObjectKey: input.originalObjectKey,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
            status: "uploaded",
          })
          .where(eq(videoUploads.id, row.id));
        await tx
          .update(videoAssets)
          .set({
            original: {
              objectKey: input.originalObjectKey,
              contentType: input.contentType,
              sizeBytes: input.sizeBytes,
            },
            sourceLabel: new URL(input.finalUrl).hostname.slice(0, 120),
          })
          .where(eq(videoAssets.assetId, row.assetId!));
      });
      return { ignored: false };
    }
    const [row] = await db
      .select()
      .from(videoUploads)
      .where(eq(videoUploads.originalObjectKey, input.originalObjectKey))
      .limit(1);
    if (
      !row ||
      !row.assetId ||
      row.status === "completed" ||
      row.status === "failed"
    )
      return { ignored: true };
    if (input.event === "video.processing.started") {
      if (
        row.status === "processing" &&
        row.processingEtag === input.originalEtag &&
        row.updatedAt.getTime() > Date.now() - 11 * 60_000
      )
        return { ignored: true };
      await db
        .update(videoUploads)
        .set({ status: "processing", processingEtag: input.originalEtag })
        .where(eq(videoUploads.id, row.id));
      return { ignored: false };
    }
    if (
      input.originalEtag &&
      row.processingEtag &&
      row.processingEtag !== input.originalEtag
    )
      return { ignored: true };
    if (input.event === "video.processing.failed") {
      await this.failUpload(row.id, row.assetId, input.error);
      return { ignored: false };
    }
    await db.transaction(async (tx) => {
      await tx
        .update(videoUploads)
        .set({
          status: "completed",
          processingEtag: input.originalEtag,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          errorMessage: null,
        })
        .where(eq(videoUploads.id, row.id));
      await tx
        .update(videoAssets)
        .set({
          original: {
            objectKey: input.originalObjectKey,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
          },
          width: input.width,
          height: input.height,
          durationSeconds: input.durationSeconds,
          poster: input.poster,
          processingStatus: "completed",
          processingError: null,
        })
        .where(eq(videoAssets.assetId, row.assetId!));
    });
    return { ignored: false };
  }

  private async failUpload(id: number, assetId: number, message: string) {
    await db.transaction(async (tx) => {
      await tx
        .update(videoUploads)
        .set({ status: "failed", errorMessage: message.slice(0, 1000) })
        .where(eq(videoUploads.id, id));
      await tx
        .update(videoAssets)
        .set({
          processingStatus: "failed",
          processingError: message.slice(0, 1000),
        })
        .where(eq(videoAssets.assetId, assetId));
    });
  }
}
