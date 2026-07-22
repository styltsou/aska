import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { uploads } from "@/db/schema";
import { first } from "@/lib/query";

export type UploadStatus =
  | "pending"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";

export type UploadRecord = {
  id: number;
  organizationId: string;
  collectionId: number | null;
  parentFolderPath: string | null;
  positionX: number | null;
  positionY: number | null;
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

const uploadSelection = {
  id: uploads.id,
  organizationId: uploads.organizationId,
  collectionId: uploads.collectionId,
  parentFolderPath: uploads.parentFolderPath,
  positionX: uploads.positionX,
  positionY: uploads.positionY,
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

/** Reads an upload only when it belongs to the requested Inbox or collection scope. */
export async function getUploadForAccess(
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

/** Reads a single upload by identity for post-create status responses. */
export async function getUploadById(
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

/** Locates the upload record that owns an image-pipeline callback object key. */
export async function getUploadByOriginalObjectKey(
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
