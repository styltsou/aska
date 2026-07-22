import { and, arrayContains, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { collectionNodes } from "@/db/schema";
import type { MoveCollectionNodeParentInput } from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseCollectionNodeId } from "@/lib/collection-node-id";
import { first } from "@/lib/query";
import { getCollectionBySlug } from "./collection-target-resolver";

export type MoveCollectionNodeParentResult = {
  nodeId: string;
  sourceParentFolderNodeId: string | null;
  sourceFolderPath: string;
  targetParentFolderNodeId: string;
  targetFolderPath: string;
  position: null;
  moved: boolean;
};

/** Moves an asset or folder placement to a different parent folder. */
export class CollectionAssetMoveService {
  async moveNodeToFolder(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
    data: MoveCollectionNodeParentInput,
  ): Promise<MoveCollectionNodeParentResult> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const source = parseCollectionNodeId(nodeId);
    const target = parseCollectionNodeId(data.targetFolderNodeId);
    const expectedParent = data.expectedParentFolderNodeId
      ? parseCollectionNodeId(data.expectedParentFolderNodeId)
      : null;

    if (target.nodeType !== "folder") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid move target");
    }
    if (expectedParent && expectedParent.nodeType !== "folder") {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Expected parent must be a folder node",
      );
    }

    return db.transaction(async (tx) => {
      const sourceCondition =
        source.nodeType === "folder"
          ? and(
              eq(collectionNodes.nodeType, "folder"),
              eq(collectionNodes.folderId, source.entityId),
            )
          : and(
              eq(collectionNodes.nodeType, "asset"),
              eq(collectionNodes.assetId, source.entityId),
            );

      const sourceNode = first(
        await tx
          .select({
            id: collectionNodes.id,
            assetId: collectionNodes.assetId,
            folderId: collectionNodes.folderId,
            parentFolderId: collectionNodes.parentFolderId,
            depth: collectionNodes.depth,
            pathFolderIds: collectionNodes.pathFolderIds,
            pathFolderSlugs: collectionNodes.pathFolderSlugs,
            pathFolderNames: collectionNodes.pathFolderNames,
          })
          .from(collectionNodes)
          .where(
            and(
              eq(collectionNodes.organizationId, orgId),
              eq(collectionNodes.collectionId, collection.id),
              sourceCondition,
            ),
          )
          .limit(1)
          .for("update"),
      );
      if (!sourceNode) {
        throw new AppError(ErrorCode.NOT_FOUND, "Node not found in collection");
      }

      const targetFolder = first(
        await tx
          .select({
            folderId: collectionNodes.folderId,
            pathFolderIds: collectionNodes.pathFolderIds,
            pathFolderSlugs: collectionNodes.pathFolderSlugs,
            pathFolderNames: collectionNodes.pathFolderNames,
          })
          .from(collectionNodes)
          .where(
            and(
              eq(collectionNodes.organizationId, orgId),
              eq(collectionNodes.collectionId, collection.id),
              eq(collectionNodes.nodeType, "folder"),
              eq(collectionNodes.folderId, target.entityId),
            ),
          )
          .limit(1)
          .for("update"),
      );
      if (!targetFolder?.folderId) {
        throw new AppError(ErrorCode.NOT_FOUND, "Target folder not found");
      }

      if (source.nodeType === "folder") {
        if (targetFolder.folderId === source.entityId) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "Cannot move a folder into itself",
          );
        }
        if (targetFolder.pathFolderIds.includes(source.entityId)) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "Cannot move a folder into one of its descendants",
          );
        }
      }

      const sourceParentFolderNodeId = sourceNode.parentFolderId
        ? `folder-${sourceNode.parentFolderId}`
        : null;
      const targetParentFolderNodeId = `folder-${targetFolder.folderId}`;
      const result = {
        nodeId,
        sourceParentFolderNodeId,
        sourceFolderPath: sourceNode.pathFolderSlugs.join("/"),
        targetParentFolderNodeId,
        targetFolderPath: targetFolder.pathFolderSlugs.join("/"),
        position: null,
      } as const;

      if (sourceNode.parentFolderId === targetFolder.folderId) {
        return { ...result, moved: false };
      }

      if (sourceNode.parentFolderId !== (expectedParent?.entityId ?? null)) {
        throw new AppError(
          ErrorCode.CONFLICT,
          "Node moved before this drag completed",
        );
      }

      if (source.nodeType === "folder") {
        const oldPrefix = sourceNode.pathFolderIds;
        const ownSlug = sourceNode.pathFolderSlugs.at(-1);
        const ownName = sourceNode.pathFolderNames.at(-1);
        if (!ownSlug || !ownName || oldPrefix.at(-1) !== source.entityId) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            "Folder path cache is invalid",
          );
        }

        const newPathFolderIds = [
          ...targetFolder.pathFolderIds,
          source.entityId,
        ];
        const newPathFolderSlugs = [...targetFolder.pathFolderSlugs, ownSlug];
        const newPathFolderNames = [...targetFolder.pathFolderNames, ownName];
        const newDepth = targetFolder.pathFolderSlugs.length;
        const depthDelta = newDepth - sourceNode.depth;
        const conflictingFolder = first(
          await tx
            .select({ id: collectionNodes.id })
            .from(collectionNodes)
            .where(
              and(
                eq(collectionNodes.organizationId, orgId),
                eq(collectionNodes.collectionId, collection.id),
                eq(collectionNodes.nodeType, "folder"),
                eq(collectionNodes.pathFolderSlugs, newPathFolderSlugs),
                ne(collectionNodes.id, sourceNode.id),
              ),
            )
            .limit(1)
            .for("update"),
        );
        if (conflictingFolder) {
          throw new AppError(
            ErrorCode.CONFLICT,
            "A folder with this name already exists in the target folder",
          );
        }

        const subtreeCandidates = await tx
          .select({
            id: collectionNodes.id,
            depth: collectionNodes.depth,
            pathFolderIds: collectionNodes.pathFolderIds,
            pathFolderSlugs: collectionNodes.pathFolderSlugs,
            pathFolderNames: collectionNodes.pathFolderNames,
          })
          .from(collectionNodes)
          .where(
            and(
              eq(collectionNodes.organizationId, orgId),
              eq(collectionNodes.collectionId, collection.id),
              arrayContains(collectionNodes.pathFolderIds, oldPrefix),
            ),
          )
          .for("update");
        const subtree = subtreeCandidates.filter((node) =>
          hasPathPrefix(node.pathFolderIds, oldPrefix),
        );

        await tx
          .update(collectionNodes)
          .set({
            parentFolderId: targetFolder.folderId,
            positionX: null,
            positionY: null,
            depth: newDepth,
            pathFolderIds: newPathFolderIds,
            pathFolderSlugs: newPathFolderSlugs,
            pathFolderNames: newPathFolderNames,
          })
          .where(eq(collectionNodes.id, sourceNode.id));

        for (const descendant of subtree) {
          if (descendant.id === sourceNode.id) continue;

          const remainderIds = descendant.pathFolderIds.slice(oldPrefix.length);
          const remainderSlugs = descendant.pathFolderSlugs.slice(
            oldPrefix.length,
          );
          const remainderNames = descendant.pathFolderNames.slice(
            oldPrefix.length,
          );

          await tx
            .update(collectionNodes)
            .set({
              pathFolderIds: [...newPathFolderIds, ...remainderIds],
              pathFolderSlugs: [...newPathFolderSlugs, ...remainderSlugs],
              pathFolderNames: [...newPathFolderNames, ...remainderNames],
              depth: descendant.depth + depthDelta,
            })
            .where(eq(collectionNodes.id, descendant.id));
        }
      } else {
        await tx
          .delete(collectionNodes)
          .where(eq(collectionNodes.id, sourceNode.id));
        await tx.insert(collectionNodes).values({
          organizationId: orgId,
          collectionId: collection.id,
          parentFolderId: targetFolder.folderId,
          nodeType: "asset",
          assetId: source.entityId,
          positionX: null,
          positionY: null,
          depth: targetFolder.pathFolderSlugs.length,
          pathFolderIds: targetFolder.pathFolderIds,
          pathFolderSlugs: targetFolder.pathFolderSlugs,
          pathFolderNames: targetFolder.pathFolderNames,
        });
      }

      return { ...result, moved: true };
    });
  }
}

function hasPathPrefix(path: number[], prefix: number[]): boolean {
  return (
    path.length >= prefix.length &&
    prefix.every((folderId, index) => path[index] === folderId)
  );
}
