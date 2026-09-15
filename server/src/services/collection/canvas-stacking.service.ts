import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { assets, canvasObjects, collectionNodes } from "@/db/schema";
import type {
  CanvasItemFrontIndex,
  UpdateCanvasItemFrontIndexesInput,
} from "@/dto/collection.dto";
import { parseCollectionNodeId } from "@/lib/collection-node-id";
import { AppError, ErrorCode } from "@/lib/errors";
import { first } from "@/lib/query";
import { planCanvasFrontIndexUpdates } from "./canvas-stacking-order";
import { getCollectionBySlug } from "./collection-target-resolver";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type StackTarget =
  | { kind: "collection"; id: number; externalId: string }
  | { kind: "text"; id: number; externalId: string };

type ExistingStackTarget = StackTarget & { frontIndex: number };

/** Persists ordering shared by collection nodes and freeform canvas text. */
export class CanvasStackingService {
  async bringItemsToFront(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: UpdateCanvasItemFrontIndexesInput,
  ): Promise<{ items: CanvasItemFrontIndex[] }> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const parentFolderId = data.expectedParentFolderNodeId
      ? parseCollectionNodeId(data.expectedParentFolderNodeId).entityId
      : null;

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${collection.id}, ${parentFolderId ?? 0})`,
      );

      if (parentFolderId !== null) {
        const parent = first(
          await tx
            .select({ id: collectionNodes.id })
            .from(collectionNodes)
            .where(
              and(
                eq(collectionNodes.organizationId, orgId),
                eq(collectionNodes.collectionId, collection.id),
                eq(collectionNodes.nodeType, "folder"),
                eq(collectionNodes.folderId, parentFolderId),
              ),
            )
            .limit(1),
        );
        if (!parent) {
          throw new AppError(ErrorCode.NOT_FOUND, "Canvas folder not found");
        }
      }

      const targets: StackTarget[] = [];
      for (const itemId of data.itemIds) {
        targets.push(
          await requireStackTarget(
            tx,
            orgId,
            collection.id,
            parentFolderId,
            itemId,
          ),
        );
      }

      const existing = await getExistingStackTargets(
        tx,
        orgId,
        collection.id,
        parentFolderId,
      );
      const updates = planCanvasFrontIndexUpdates(
        existing.map((item) => ({
          id: item.externalId,
          frontIndex: item.frontIndex,
        })),
        targets.map((item) => item.externalId),
      );
      if (!updates) {
        throw new AppError(
          ErrorCode.CONFLICT,
          "Canvas front-order capacity has been reached",
        );
      }

      const targetsByExternalId = new Map(
        [...existing, ...targets].map((item) => [item.externalId, item]),
      );
      for (const update of updates) {
        await updateFrontIndex(
          tx,
          targetsByExternalId.get(update.id)!,
          update.frontIndex,
          userId,
        );
      }

      return { items: updates };
    });
  }
}

async function requireStackTarget(
  tx: DatabaseTransaction,
  orgId: string,
  collectionId: number,
  parentFolderId: number | null,
  itemId: string,
): Promise<StackTarget> {
  const match = /^(folder|image|note|link|color|text)-(\d+)$/.exec(itemId);
  const entityId = match ? Number(match[2]) : NaN;
  if (!match || !Number.isSafeInteger(entityId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid canvas item id");
  }

  const itemType = match[1] as
    | "folder"
    | "image"
    | "note"
    | "link"
    | "color"
    | "text";
  const parentCondition =
    parentFolderId === null
      ? isNull(collectionNodes.parentFolderId)
      : eq(collectionNodes.parentFolderId, parentFolderId);
  if (itemType !== "text") {
    const row = first(
      await tx
        .select({
          id: collectionNodes.id,
          nodeType: collectionNodes.nodeType,
          folderId: collectionNodes.folderId,
          assetId: collectionNodes.assetId,
          assetType: assets.type,
        })
        .from(collectionNodes)
        .leftJoin(assets, eq(assets.id, collectionNodes.assetId))
        .where(
          and(
            eq(collectionNodes.organizationId, orgId),
            eq(collectionNodes.collectionId, collectionId),
            parentCondition,
            itemType === "folder"
              ? and(
                  eq(collectionNodes.nodeType, "folder"),
                  eq(collectionNodes.folderId, entityId),
                )
              : and(
                  eq(collectionNodes.nodeType, "asset"),
                  eq(collectionNodes.assetId, entityId),
                  eq(assets.type, itemType),
                ),
          ),
        )
        .limit(1)
        .for("update", { of: collectionNodes }),
    );
    if (!row) {
      throw new AppError(
        ErrorCode.CONFLICT,
        "Canvas item moved before its front order could be saved",
      );
    }
    return { kind: "collection", id: row.id, externalId: itemId };
  }

  const textParentCondition =
    parentFolderId === null
      ? isNull(canvasObjects.parentFolderId)
      : eq(canvasObjects.parentFolderId, parentFolderId);
  const row = first(
    await tx
      .select({ id: canvasObjects.id })
      .from(canvasObjects)
      .where(
        and(
          eq(canvasObjects.organizationId, orgId),
          eq(canvasObjects.collectionId, collectionId),
          eq(canvasObjects.objectType, "text"),
          eq(canvasObjects.id, entityId),
          textParentCondition,
        ),
      )
      .limit(1)
      .for("update"),
  );
  if (!row) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "Canvas item moved before its front order could be saved",
    );
  }
  return { kind: "text", id: row.id, externalId: itemId };
}

async function getExistingStackTargets(
  tx: DatabaseTransaction,
  orgId: string,
  collectionId: number,
  parentFolderId: number | null,
): Promise<ExistingStackTarget[]> {
  const collectionParentCondition =
    parentFolderId === null
      ? isNull(collectionNodes.parentFolderId)
      : eq(collectionNodes.parentFolderId, parentFolderId);
  const textParentCondition =
    parentFolderId === null
      ? isNull(canvasObjects.parentFolderId)
      : eq(canvasObjects.parentFolderId, parentFolderId);
  const nodeRows = await tx
    .select({
      id: collectionNodes.id,
      nodeType: collectionNodes.nodeType,
      folderId: collectionNodes.folderId,
      assetId: collectionNodes.assetId,
      assetType: assets.type,
      frontIndex: collectionNodes.frontIndex,
    })
    .from(collectionNodes)
    .leftJoin(assets, eq(assets.id, collectionNodes.assetId))
    .where(
      and(
        eq(collectionNodes.organizationId, orgId),
        eq(collectionNodes.collectionId, collectionId),
        collectionParentCondition,
        isNotNull(collectionNodes.frontIndex),
      ),
    )
    .orderBy(asc(collectionNodes.frontIndex), asc(collectionNodes.id))
    .for("update", { of: collectionNodes });
  const textRows = await tx
    .select({
      id: canvasObjects.id,
      frontIndex: canvasObjects.frontIndex,
    })
    .from(canvasObjects)
    .where(
      and(
        eq(canvasObjects.organizationId, orgId),
        eq(canvasObjects.collectionId, collectionId),
        eq(canvasObjects.objectType, "text"),
        textParentCondition,
        isNotNull(canvasObjects.frontIndex),
      ),
    )
    .orderBy(asc(canvasObjects.frontIndex), asc(canvasObjects.id))
    .for("update");

  return [
    ...nodeRows.map(
      (row): ExistingStackTarget => ({
        kind: "collection",
        id: row.id,
        externalId:
          row.nodeType === "folder"
            ? `folder-${row.folderId}`
            : `${row.assetType}-${row.assetId}`,
        frontIndex: row.frontIndex!,
      }),
    ),
    ...textRows.map(
      (row): ExistingStackTarget => ({
        kind: "text",
        id: row.id,
        externalId: `text-${row.id}`,
        frontIndex: row.frontIndex!,
      }),
    ),
  ].sort(
    (left, right) =>
      left.frontIndex - right.frontIndex ||
      left.externalId.localeCompare(right.externalId),
  );
}

async function updateFrontIndex(
  tx: DatabaseTransaction,
  target: StackTarget,
  frontIndex: number,
  userId: string,
) {
  if (target.kind === "collection") {
    await tx
      .update(collectionNodes)
      .set({ frontIndex })
      .where(eq(collectionNodes.id, target.id));
    return;
  }

  await tx
    .update(canvasObjects)
    .set({ frontIndex, updatedByUserId: userId, updatedAt: new Date() })
    .where(eq(canvasObjects.id, target.id));
}
