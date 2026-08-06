import { and, arrayContains, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { assets, collectionNodes, folders, imageAssets } from "@/db/schema";
import type { MoveCollectionNodesParentInput } from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseCollectionNodeId } from "@/lib/collection-node-id";
import { first } from "@/lib/query";
import { getCollectionBySlug } from "./collection-target-resolver";
import {
  getFlattenGroupAnchor,
  getFolderMovePosition,
} from "./collection-move-placement";

export type MoveCollectionNodeParentResult = {
  nodeId: string;
  sourceParentFolderNodeId: string | null;
  sourceFolderPath: string;
  targetParentFolderNodeId: string | null;
  targetFolderPath: string;
  position: { x: number; y: number } | null;
  moved: boolean;
};

export type MoveCollectionNodesParentResult = {
  moves: MoveCollectionNodeParentResult[];
};

export type FlattenFolderResult = {
  folderNodeId: string;
  parentFolderNodeId: string | null;
  directChildCount: number;
  position: { x: number; y: number } | null;
};

/** Handles transactional folder-parent and folder-flatten mutations. */
export class CollectionAssetMoveService {
  async flattenFolder(
    orgId: string,
    collectionSlug: string,
    folderNodeId: string,
  ): Promise<FlattenFolderResult> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const target = parseCollectionNodeId(folderNodeId);
    if (target.nodeType !== "folder") {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Only folders can be flattened",
      );
    }

    return db.transaction(async (tx) => {
      const folderNode = first(
        await tx
          .select({
            id: collectionNodes.id,
            folderId: collectionNodes.folderId,
            parentFolderId: collectionNodes.parentFolderId,
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
      if (!folderNode?.folderId) {
        throw new AppError(ErrorCode.NOT_FOUND, "Folder not found");
      }

      const directChildren = await tx
        .select({
          id: collectionNodes.id,
          nodeType: collectionNodes.nodeType,
          assetType: assets.type,
          imageWidth: imageAssets.width,
          imageHeight: imageAssets.height,
          positionX: collectionNodes.positionX,
          positionY: collectionNodes.positionY,
        })
        .from(collectionNodes)
        .leftJoin(assets, eq(assets.id, collectionNodes.assetId))
        .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .where(
          and(
            eq(collectionNodes.organizationId, orgId),
            eq(collectionNodes.collectionId, collection.id),
            eq(collectionNodes.parentFolderId, folderNode.folderId),
          ),
        )
        .for("update", { of: collectionNodes });

      if (
        directChildren.some(
          (child) => child.positionX === null || child.positionY === null,
        )
      ) {
        throw new AppError(
          ErrorCode.CONFLICT,
          "Flattening requires every direct child to have a saved canvas position",
        );
      }

      const parentNodes = await tx
        .select({
          nodeType: collectionNodes.nodeType,
          assetType: assets.type,
          imageWidth: imageAssets.width,
          imageHeight: imageAssets.height,
          positionX: collectionNodes.positionX,
          positionY: collectionNodes.positionY,
        })
        .from(collectionNodes)
        .leftJoin(assets, eq(assets.id, collectionNodes.assetId))
        .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .where(
          and(
            eq(collectionNodes.organizationId, orgId),
            eq(collectionNodes.collectionId, collection.id),
            folderNode.parentFolderId === null
              ? isNull(collectionNodes.parentFolderId)
              : eq(collectionNodes.parentFolderId, folderNode.parentFolderId),
            ne(collectionNodes.id, folderNode.id),
          ),
        )
        .for("update", { of: collectionNodes });
      const anchor = getFlattenGroupAnchor(parentNodes);
      const offset =
        directChildren.length === 0
          ? { x: 0, y: 0 }
          : {
              x:
                anchor.x -
                Math.min(...directChildren.map((child) => child.positionX!)),
              y:
                anchor.y -
                Math.min(...directChildren.map((child) => child.positionY!)),
            };

      const oldPrefix = folderNode.pathFolderIds;
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
      const subtree = subtreeCandidates.filter(
        (node) =>
          node.id !== folderNode.id &&
          hasPathPrefix(node.pathFolderIds, oldPrefix),
      );
      const parentPathIds = oldPrefix.slice(0, -1);
      const parentPathSlugs = folderNode.pathFolderSlugs.slice(0, -1);
      const parentPathNames = folderNode.pathFolderNames.slice(0, -1);

      for (const child of directChildren) {
        await tx
          .update(collectionNodes)
          .set({
            parentFolderId: folderNode.parentFolderId,
            positionX: child.positionX! + offset.x,
            positionY: child.positionY! + offset.y,
          })
          .where(eq(collectionNodes.id, child.id));
      }

      for (const node of subtree) {
        await tx
          .update(collectionNodes)
          .set({
            depth: node.depth - 1,
            pathFolderIds: [
              ...parentPathIds,
              ...node.pathFolderIds.slice(oldPrefix.length),
            ],
            pathFolderSlugs: [
              ...parentPathSlugs,
              ...node.pathFolderSlugs.slice(oldPrefix.length),
            ],
            pathFolderNames: [
              ...parentPathNames,
              ...node.pathFolderNames.slice(oldPrefix.length),
            ],
          })
          .where(eq(collectionNodes.id, node.id));
      }

      await tx
        .delete(folders)
        .where(
          and(
            eq(folders.organizationId, orgId),
            eq(folders.id, folderNode.folderId),
          ),
        );

      return {
        folderNodeId,
        parentFolderNodeId: folderNode.parentFolderId
          ? `folder-${folderNode.parentFolderId}`
          : null,
        directChildCount: directChildren.length,
        position: directChildren.length > 0 ? anchor : null,
      };
    });
  }

  async moveNodesToFolder(
    orgId: string,
    collectionSlug: string,
    data: MoveCollectionNodesParentInput,
  ): Promise<MoveCollectionNodesParentResult> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const sources = data.nodeIds.map((nodeId) => ({
      nodeId,
      source: parseCollectionNodeId(nodeId),
    }));
    const sourcesInLockOrder = [...sources].sort((left, right) =>
      left.source.nodeType === right.source.nodeType
        ? left.source.entityId - right.source.entityId
        : left.source.nodeType.localeCompare(right.source.nodeType),
    );
    const target = data.targetFolderNodeId
      ? parseCollectionNodeId(data.targetFolderNodeId)
      : null;

    if (target && target.nodeType !== "folder") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid move target");
    }

    return db.transaction(async (tx) => {
      const movesByNodeId = new Map<string, MoveCollectionNodeParentResult>();
      const targetFolder = target
        ? first(
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
          )
        : {
            folderId: null,
            pathFolderIds: [],
            pathFolderSlugs: [],
            pathFolderNames: [],
          };
      if (!targetFolder) {
        throw new AppError(ErrorCode.NOT_FOUND, "Target folder not found");
      }

      for (const { nodeId, source } of sourcesInLockOrder) {
        const sourceNode = await getMoveSourceNode(tx, orgId, source);
        const sourceNodeId = sourceNode.id;

        if (source.nodeType === "folder") {
          if (
            sourceNodeId === null ||
            sourceNode.collectionId !== collection.id
          ) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              "Folders can only be moved within their collection",
            );
          }
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
        const targetParentFolderNodeId = targetFolder.folderId
          ? `folder-${targetFolder.folderId}`
          : null;
        const result = {
          nodeId,
          sourceParentFolderNodeId,
          sourceFolderPath: sourceNode.pathFolderSlugs.join("/"),
          targetParentFolderNodeId,
          targetFolderPath: targetFolder.pathFolderSlugs.join("/"),
          position: null,
        } as const;

        if (
          sourceNode.collectionId === collection.id &&
          sourceNode.parentFolderId === targetFolder.folderId
        ) {
          movesByNodeId.set(nodeId, { ...result, moved: false });
          continue;
        }

        const destinationNodes = await tx
          .select({
            nodeType: collectionNodes.nodeType,
            assetType: assets.type,
            imageWidth: imageAssets.width,
            imageHeight: imageAssets.height,
            positionX: collectionNodes.positionX,
            positionY: collectionNodes.positionY,
          })
          .from(collectionNodes)
          .leftJoin(assets, eq(assets.id, collectionNodes.assetId))
          .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
          .where(
            and(
              eq(collectionNodes.organizationId, orgId),
              eq(collectionNodes.collectionId, collection.id),
              targetFolder.folderId === null
                ? isNull(collectionNodes.parentFolderId)
                : eq(collectionNodes.parentFolderId, targetFolder.folderId),
            ),
          )
          .for("update", { of: collectionNodes });
        const position = getFolderMovePosition(destinationNodes, sourceNode);

        if (source.nodeType === "folder") {
          if (sourceNodeId === null) {
            throw new AppError(
              ErrorCode.INTERNAL_ERROR,
              "Folder node is invalid",
            );
          }
          const folderNodeId = sourceNodeId;
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
                  ne(collectionNodes.id, folderNodeId),
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
              positionX: position.x,
              positionY: position.y,
              depth: newDepth,
              pathFolderIds: newPathFolderIds,
              pathFolderSlugs: newPathFolderSlugs,
              pathFolderNames: newPathFolderNames,
            })
            .where(eq(collectionNodes.id, folderNodeId));

          for (const descendant of subtree) {
            if (descendant.id === folderNodeId) continue;

            const remainderIds = descendant.pathFolderIds.slice(
              oldPrefix.length,
            );
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
          if (sourceNode.id !== null) {
            await tx
              .delete(collectionNodes)
              .where(eq(collectionNodes.id, sourceNode.id));
          }
          await tx.insert(collectionNodes).values({
            organizationId: orgId,
            collectionId: collection.id,
            parentFolderId: targetFolder.folderId,
            nodeType: "asset",
            assetId: source.entityId,
            positionX: position.x,
            positionY: position.y,
            depth: targetFolder.pathFolderSlugs.length,
            pathFolderIds: targetFolder.pathFolderIds,
            pathFolderSlugs: targetFolder.pathFolderSlugs,
            pathFolderNames: targetFolder.pathFolderNames,
          });
        }

        movesByNodeId.set(nodeId, { ...result, position, moved: true });
      }

      return {
        moves: sources.map(({ nodeId }) => movesByNodeId.get(nodeId)!),
      };
    });
  }
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type MoveSourceNode = {
  id: number | null;
  collectionId: number | null;
  nodeType: "asset" | "folder";
  assetId: number | null;
  folderId: number | null;
  parentFolderId: number | null;
  positionX: number | null;
  positionY: number | null;
  depth: number;
  pathFolderIds: number[];
  pathFolderSlugs: string[];
  pathFolderNames: string[];
  assetType: "image" | "note" | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

async function getMoveSourceNode(
  tx: DatabaseTransaction,
  orgId: string,
  source: ReturnType<typeof parseCollectionNodeId>,
): Promise<MoveSourceNode> {
  if (source.nodeType === "folder") {
    const folderNode = first(
      await tx
        .select({
          id: collectionNodes.id,
          collectionId: collectionNodes.collectionId,
          folderId: collectionNodes.folderId,
          parentFolderId: collectionNodes.parentFolderId,
          positionX: collectionNodes.positionX,
          positionY: collectionNodes.positionY,
          depth: collectionNodes.depth,
          pathFolderIds: collectionNodes.pathFolderIds,
          pathFolderSlugs: collectionNodes.pathFolderSlugs,
          pathFolderNames: collectionNodes.pathFolderNames,
        })
        .from(collectionNodes)
        .where(
          and(
            eq(collectionNodes.organizationId, orgId),
            eq(collectionNodes.nodeType, "folder"),
            eq(collectionNodes.folderId, source.entityId),
          ),
        )
        .limit(1)
        .for("update"),
    );
    if (!folderNode) {
      throw new AppError(ErrorCode.NOT_FOUND, "Folder not found");
    }

    return {
      ...folderNode,
      nodeType: "folder",
      assetId: null,
      assetType: null,
      imageWidth: null,
      imageHeight: null,
    };
  }

  const asset = first(
    await tx
      .select({
        id: assets.id,
        type: assets.type,
        imageWidth: imageAssets.width,
        imageHeight: imageAssets.height,
      })
      .from(assets)
      .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
      .where(
        and(eq(assets.organizationId, orgId), eq(assets.id, source.entityId)),
      )
      .limit(1)
      .for("update", { of: assets }),
  );
  if (!asset || asset.type !== source.assetType) {
    throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
  }

  const placement = first(
    await tx
      .select({
        id: collectionNodes.id,
        collectionId: collectionNodes.collectionId,
        parentFolderId: collectionNodes.parentFolderId,
        positionX: collectionNodes.positionX,
        positionY: collectionNodes.positionY,
        depth: collectionNodes.depth,
        pathFolderIds: collectionNodes.pathFolderIds,
        pathFolderSlugs: collectionNodes.pathFolderSlugs,
        pathFolderNames: collectionNodes.pathFolderNames,
      })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.organizationId, orgId),
          eq(collectionNodes.nodeType, "asset"),
          eq(collectionNodes.assetId, asset.id),
        ),
      )
      .limit(1)
      .for("update"),
  );

  return {
    id: placement?.id ?? null,
    collectionId: placement?.collectionId ?? null,
    nodeType: "asset",
    assetId: asset.id,
    folderId: null,
    parentFolderId: placement?.parentFolderId ?? null,
    positionX: placement?.positionX ?? null,
    positionY: placement?.positionY ?? null,
    depth: placement?.depth ?? 0,
    pathFolderIds: placement?.pathFolderIds ?? [],
    pathFolderSlugs: placement?.pathFolderSlugs ?? [],
    pathFolderNames: placement?.pathFolderNames ?? [],
    assetType: asset.type,
    imageWidth: asset.imageWidth,
    imageHeight: asset.imageHeight,
  };
}

function hasPathPrefix(path: number[], prefix: number[]): boolean {
  return (
    path.length >= prefix.length &&
    prefix.every((folderId, index) => path[index] === folderId)
  );
}
