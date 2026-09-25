import { and, arrayContains, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  canvasArrowObjects,
  canvasObjects,
  canvasTextObjects,
  collectionNodes,
  folders,
  imageAssets,
} from "@/db/schema";
import type { MoveCollectionNodesParentInput } from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseCollectionNodeId } from "@/lib/collection-node-id";
import { first } from "@/lib/query";
import {
  getCollectionBySlug,
  resolveTargetInCollection,
} from "./collection-target-resolver";
import {
  getCompositionMoveOffset,
  getMovePlacementItem,
  getFlattenGroupAnchor,
  getFolderMovePosition,
  type MovePlacementItem,
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
            positionX: collectionNodes.positionX,
            positionY: collectionNodes.positionY,
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
      const singleChild =
        directChildren.length === 1 ? directChildren[0] : null;
      const anchorForPosition = singleChild
        ? {
            x: folderNode.positionX ?? anchor.x,
            y: folderNode.positionY ?? anchor.y,
          }
        : anchor;
      const offset =
        directChildren.length === 0
          ? { x: 0, y: 0 }
          : {
              x:
                anchorForPosition.x -
                Math.min(...directChildren.map((child) => child.positionX!)),
              y:
                anchorForPosition.y -
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
            frontIndex: null,
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
        position: directChildren.length > 0 ? anchorForPosition : null,
      };
    });
  }

  async moveNodesToFolder(
    orgId: string,
    collectionSlug: string,
    data: MoveCollectionNodesParentInput,
  ): Promise<MoveCollectionNodesParentResult> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const sourceCollection = data.sourceCollectionSlug
      ? await getCollectionBySlug(orgId, data.sourceCollectionSlug)
      : null;
    const sourceTarget = sourceCollection
      ? await resolveTargetInCollection(sourceCollection, data.sourceFolderPath)
      : null;
    const sources = data.nodeIds
      .filter((id) => !/^(text|arrow)-/.test(id))
      .map((nodeId) => ({
        nodeId,
        source: parseCollectionNodeId(nodeId),
      }));
    const selectedCanvasIds = data.nodeIds.filter((id) =>
      /^(text|arrow)-/.test(id),
    );
    if (selectedCanvasIds.length > 0 && !sourceTarget) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Canvas moves need a source collection",
      );
    }
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
      const oldToNewNodeIds = new Map<number, number>();
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

      const sourceRows = new Map<string, MoveSourceNode>();
      for (const { nodeId, source } of sourcesInLockOrder) {
        const row = await getMoveSourceNode(tx, orgId, source);
        if (
          sourceTarget &&
          (row.collectionId !== sourceTarget.collection.id ||
            row.parentFolderId !== sourceTarget.parentFolderId)
        ) {
          throw new AppError(ErrorCode.CONFLICT, "The source canvas changed");
        }
        sourceRows.set(nodeId, row);
      }
      const sourceObjects = sourceTarget
        ? await tx
            .select({
              id: canvasObjects.id,
              objectType: canvasObjects.objectType,
              frontIndex: canvasObjects.frontIndex,
              positionX: canvasTextObjects.positionX,
              positionY: canvasTextObjects.positionY,
              content: canvasTextObjects.content,
              startX: canvasArrowObjects.startX,
              startY: canvasArrowObjects.startY,
              endX: canvasArrowObjects.endX,
              endY: canvasArrowObjects.endY,
              points: canvasArrowObjects.points,
              rotation: canvasArrowObjects.rotation,
              startCollectionNodeId: canvasArrowObjects.startCollectionNodeId,
              endCollectionNodeId: canvasArrowObjects.endCollectionNodeId,
              startCanvasObjectId: canvasArrowObjects.startCanvasObjectId,
              endCanvasObjectId: canvasArrowObjects.endCanvasObjectId,
              startAnchorX: canvasArrowObjects.startAnchorX,
              startAnchorY: canvasArrowObjects.startAnchorY,
              endAnchorX: canvasArrowObjects.endAnchorX,
              endAnchorY: canvasArrowObjects.endAnchorY,
            })
            .from(canvasObjects)
            .leftJoin(
              canvasTextObjects,
              eq(canvasTextObjects.canvasObjectId, canvasObjects.id),
            )
            .leftJoin(
              canvasArrowObjects,
              eq(canvasArrowObjects.canvasObjectId, canvasObjects.id),
            )
            .where(
              and(
                eq(canvasObjects.organizationId, orgId),
                eq(canvasObjects.collectionId, sourceTarget.collection.id),
                sourceTarget.parentFolderId === null
                  ? isNull(canvasObjects.parentFolderId)
                  : eq(
                      canvasObjects.parentFolderId,
                      sourceTarget.parentFolderId,
                    ),
              ),
            )
        : [];
      const sourceObjectById = new Map(
        sourceObjects.map((row) => [`${row.objectType}-${row.id}`, row]),
      );
      if (selectedCanvasIds.some((id) => !sourceObjectById.has(id))) {
        throw new AppError(
          ErrorCode.CONFLICT,
          "The selected canvas object changed",
        );
      }
      const movedCollectionNodeIds = new Set(
        [...sourceRows.values()]
          .map((row) => row.id)
          .filter((id): id is number => id !== null),
      );
      const movedTextIds = new Set(
        selectedCanvasIds
          .filter((id) => id.startsWith("text-"))
          .map((id) => Number(id.slice(5))),
      );
      const endpointMoves = (
        row: (typeof sourceObjects)[number],
        side: "start" | "end",
      ) => {
        const nodeId =
          side === "start"
            ? row.startCollectionNodeId
            : row.endCollectionNodeId;
        const objectId =
          side === "start" ? row.startCanvasObjectId : row.endCanvasObjectId;
        return (
          (nodeId !== null && movedCollectionNodeIds.has(nodeId)) ||
          (objectId !== null && movedTextIds.has(objectId))
        );
      };
      const movingArrowIds = new Set(
        selectedCanvasIds
          .filter((id) => id.startsWith("arrow-"))
          .map((id) => Number(id.slice(6))),
      );
      for (const row of sourceObjects) {
        if (
          row.objectType === "arrow" &&
          endpointMoves(row, "start") &&
          endpointMoves(row, "end")
        ) {
          movingArrowIds.add(row.id);
        }
      }
      const snapshots = new Map(
        data.arrowSnapshots?.map((snapshot) => [snapshot.id, snapshot]) ?? [],
      );
      const measurements = new Map(
        data.measurements?.map((measurement) => [
          measurement.id,
          measurement,
        ]) ?? [],
      );
      const movingItems: MovePlacementItem[] = [];
      for (const { nodeId } of sources) {
        const row = sourceRows.get(nodeId)!;
        if (!sourceTarget) continue;
        const item = getMovePlacementItem(row);
        const measured = measurements.get(nodeId);
        movingItems.push({
          ...item,
          position: measured?.position ?? item.position,
          footprint: measured
            ? { width: measured.width, height: measured.height }
            : item.footprint,
        });
      }
      for (const row of sourceObjects) {
        const id = `${row.objectType}-${row.id}`;
        if (row.objectType === "text" && movedTextIds.has(row.id)) {
          const measured = measurements.get(id);
          movingItems.push({
            position: measured?.position ?? {
              x: row.positionX!,
              y: row.positionY!,
            },
            footprint: measured
              ? { width: measured.width, height: measured.height }
              : { width: 280, height: 40 },
          });
        }
        if (row.objectType === "arrow" && movingArrowIds.has(row.id)) {
          const snapshot = snapshots.get(id);
          const allPoints = snapshot
            ? [snapshot.start, snapshot.end, ...snapshot.points]
            : [
                { x: row.startX!, y: row.startY! },
                { x: row.endX!, y: row.endY! },
                ...(row.points ?? []),
              ];
          const left = Math.min(...allPoints.map((point) => point.x));
          const top = Math.min(...allPoints.map((point) => point.y));
          movingItems.push({
            position: { x: left, y: top },
            footprint: {
              width: Math.max(
                1,
                Math.max(...allPoints.map((point) => point.x)) - left,
              ),
              height: Math.max(
                1,
                Math.max(...allPoints.map((point) => point.y)) - top,
              ),
            },
          });
        }
      }
      const initialDestinationNodes = await tx
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
        );
      const destinationItems = initialDestinationNodes
        .filter((row) => row.positionX !== null && row.positionY !== null)
        .map(getMovePlacementItem);
      const destinationText = await tx
        .select({
          x: canvasTextObjects.positionX,
          y: canvasTextObjects.positionY,
          content: canvasTextObjects.content,
        })
        .from(canvasObjects)
        .innerJoin(
          canvasTextObjects,
          eq(canvasTextObjects.canvasObjectId, canvasObjects.id),
        )
        .where(
          and(
            eq(canvasObjects.organizationId, orgId),
            eq(canvasObjects.collectionId, collection.id),
            targetFolder.folderId === null
              ? isNull(canvasObjects.parentFolderId)
              : eq(canvasObjects.parentFolderId, targetFolder.folderId),
          ),
        );
      destinationItems.push(
        ...destinationText.map((row) => ({
          position: { x: row.x, y: row.y },
          footprint: {
            width: Math.min(
              800,
              Math.max(
                80,
                Math.max(
                  ...row.content.split("\n").map((line) => line.length),
                ) * 16,
              ),
            ),
            height: Math.max(40, row.content.split("\n").length * 36),
          },
        })),
      );
      const groupOffset = sourceTarget
        ? getCompositionMoveOffset(destinationItems, movingItems)
        : { x: 0, y: 0 };

      for (const { nodeId, source } of sourcesInLockOrder) {
        const sourceNode = sourceRows.get(nodeId)!;
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

        const position = sourceTarget
          ? {
              x:
                (measurements.get(nodeId)?.position?.x ??
                  sourceNode.positionX ??
                  0) + groupOffset.x,
              y:
                (measurements.get(nodeId)?.position?.y ??
                  sourceNode.positionY ??
                  0) + groupOffset.y,
            }
          : getFolderMovePosition(
              await tx
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
                      : eq(
                          collectionNodes.parentFolderId,
                          targetFolder.folderId,
                        ),
                  ),
                ),
              sourceNode,
              sources.length > 1,
            );

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
              frontIndex: null,
              depth: newDepth,
              pathFolderIds: newPathFolderIds,
              pathFolderSlugs: newPathFolderSlugs,
              pathFolderNames: newPathFolderNames,
            })
            .where(eq(collectionNodes.id, folderNodeId));
          oldToNewNodeIds.set(folderNodeId, folderNodeId);

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
          if (
            sourceNode.id !== null &&
            sourceNode.collectionId === collection.id
          ) {
            await tx
              .update(collectionNodes)
              .set({
                parentFolderId: targetFolder.folderId,
                positionX: position.x,
                positionY: position.y,
                frontIndex: null,
                depth: targetFolder.pathFolderSlugs.length,
                pathFolderIds: targetFolder.pathFolderIds,
                pathFolderSlugs: targetFolder.pathFolderSlugs,
                pathFolderNames: targetFolder.pathFolderNames,
              })
              .where(eq(collectionNodes.id, sourceNode.id));
            oldToNewNodeIds.set(sourceNode.id, sourceNode.id);
          } else {
            if (sourceNode.id !== null) {
              await tx
                .delete(collectionNodes)
                .where(eq(collectionNodes.id, sourceNode.id));
            }

            const [inserted] = await tx
              .insert(collectionNodes)
              .values({
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
              })
              .returning({ id: collectionNodes.id });
            if (sourceNode.id !== null && inserted) {
              oldToNewNodeIds.set(sourceNode.id, inserted.id);
            }
          }
        }

        movesByNodeId.set(nodeId, { ...result, position, moved: true });
      }

      if (sourceTarget) {
        const sourceParentFolderNodeId = sourceTarget.parentFolderId
          ? `folder-${sourceTarget.parentFolderId}`
          : null;
        const targetParentFolderNodeId = targetFolder.folderId
          ? `folder-${targetFolder.folderId}`
          : null;
        const sameLocation =
          sourceTarget.collection.id === collection.id &&
          sourceTarget.parentFolderId === targetFolder.folderId;
        const moveResult = (
          nodeId: string,
          position: { x: number; y: number } | null,
        ) => ({
          nodeId,
          sourceParentFolderNodeId,
          sourceFolderPath: sourceTarget.pathFolderSlugs.join("/"),
          targetParentFolderNodeId,
          targetFolderPath: targetFolder.pathFolderSlugs.join("/"),
          position,
          moved: !sameLocation,
        });
        for (const row of sourceObjects) {
          if (row.objectType !== "text" || !movedTextIds.has(row.id)) continue;
          const nodeId = `text-${row.id}`;
          const position = {
            x:
              (measurements.get(nodeId)?.position?.x ?? row.positionX!) +
              (sameLocation ? 0 : groupOffset.x),
            y:
              (measurements.get(nodeId)?.position?.y ?? row.positionY!) +
              (sameLocation ? 0 : groupOffset.y),
          };
          if (!sameLocation) {
            await tx
              .update(canvasObjects)
              .set({
                collectionId: collection.id,
                parentFolderId: targetFolder.folderId,
                frontIndex: null,
              })
              .where(eq(canvasObjects.id, row.id));
            await tx
              .update(canvasTextObjects)
              .set({ positionX: position.x, positionY: position.y })
              .where(eq(canvasTextObjects.canvasObjectId, row.id));
          }
          movesByNodeId.set(nodeId, moveResult(nodeId, position));
        }

        for (const row of sourceObjects) {
          if (row.objectType !== "arrow") continue;
          const moving = movingArrowIds.has(row.id);
          const startMoves = endpointMoves(row, "start");
          const endMoves = endpointMoves(row, "end");
          if (!moving && !startMoves && !endMoves) continue;
          const nodeId = `arrow-${row.id}`;
          const snapshot = snapshots.get(nodeId);
          const offset = moving && !sameLocation ? groupOffset : { x: 0, y: 0 };
          const start = snapshot?.start ?? { x: row.startX!, y: row.startY! };
          const end = snapshot?.end ?? { x: row.endX!, y: row.endY! };
          const preserveStart = moving ? startMoves : !startMoves;
          const preserveEnd = moving ? endMoves : !endMoves;
          if (!sameLocation) {
            await tx
              .update(canvasObjects)
              .set({
                ...(moving
                  ? {
                      collectionId: collection.id,
                      parentFolderId: targetFolder.folderId,
                    }
                  : {}),
                updatedAt: new Date(),
              })
              .where(eq(canvasObjects.id, row.id));
            await tx
              .update(canvasArrowObjects)
              .set({
                startX: start.x + offset.x,
                startY: start.y + offset.y,
                endX: end.x + offset.x,
                endY: end.y + offset.y,
                points: (snapshot?.points ?? row.points ?? []).map((point) => ({
                  x: point.x + offset.x,
                  y: point.y + offset.y,
                })),
                startCollectionNodeId: preserveStart
                  ? (oldToNewNodeIds.get(row.startCollectionNodeId ?? -1) ??
                    row.startCollectionNodeId)
                  : null,
                endCollectionNodeId: preserveEnd
                  ? (oldToNewNodeIds.get(row.endCollectionNodeId ?? -1) ??
                    row.endCollectionNodeId)
                  : null,
                startCanvasObjectId: preserveStart
                  ? row.startCanvasObjectId
                  : null,
                endCanvasObjectId: preserveEnd ? row.endCanvasObjectId : null,
                startAnchorX: preserveStart ? row.startAnchorX : null,
                startAnchorY: preserveStart ? row.startAnchorY : null,
                endAnchorX: preserveEnd ? row.endAnchorX : null,
                endAnchorY: preserveEnd ? row.endAnchorY : null,
              })
              .where(eq(canvasArrowObjects.canvasObjectId, row.id));
          }
          if (moving) movesByNodeId.set(nodeId, moveResult(nodeId, null));
        }
      }

      return {
        moves: [
          ...data.nodeIds.map((nodeId) => movesByNodeId.get(nodeId)!),
          ...[...movingArrowIds]
            .map((id) => `arrow-${id}`)
            .filter((id) => !data.nodeIds.includes(id))
            .map((id) => movesByNodeId.get(id)!),
        ],
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
  assetType: "image" | "note" | "link" | "color" | null;
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
