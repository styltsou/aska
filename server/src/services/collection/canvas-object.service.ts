import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  canvasArrowObjects,
  canvasObjects,
  canvasTextObjects,
  collectionNodes,
} from "@/db/schema";
import type {
  CanvasArrowObject,
  CanvasObject,
  CanvasTextObject,
  CreateCanvasArrowInput,
  CreateCanvasTextInput,
  UpdateCanvasArrowInput,
  UpdateCanvasTextInput,
} from "@/dto/collection.dto";
import { parseCollectionNodeId } from "@/lib/collection-node-id";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  getCollectionBySlug,
  resolveTargetInCollection,
} from "./collection-target-resolver";

type CanvasParent = {
  collectionId: number;
  parentFolderId: number | null;
};

type ResolvedBinding = {
  collectionNodeId: number | null;
  canvasObjectId: number | null;
};

function parseCanvasObjectId(objectId: string) {
  const match = /^(text|arrow)-(\d+)$/.exec(objectId);
  const id = match ? Number(match[2]) : NaN;
  if (!match || !Number.isSafeInteger(id)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid canvas object id");
  }
  return { type: match[1] as "text" | "arrow", id };
}

export class CanvasObjectService {
  async getObjects(
    orgId: string,
    collectionId: number,
    parentFolderId: number | null,
  ): Promise<CanvasObject[]> {
    const rows = await db
      .select({
        id: canvasObjects.id,
        objectType: canvasObjects.objectType,
        frontIndex: canvasObjects.frontIndex,
        createdAt: canvasObjects.createdAt,
        updatedAt: canvasObjects.updatedAt,
        content: canvasTextObjects.content,
        positionX: canvasTextObjects.positionX,
        positionY: canvasTextObjects.positionY,
        font: canvasTextObjects.font,
        size: canvasTextObjects.size,
        textColor: canvasTextObjects.color,
        startX: canvasArrowObjects.startX,
        startY: canvasArrowObjects.startY,
        endX: canvasArrowObjects.endX,
        endY: canvasArrowObjects.endY,
        startCollectionNodeId: canvasArrowObjects.startCollectionNodeId,
        startCanvasObjectId: canvasArrowObjects.startCanvasObjectId,
        startAnchorX: canvasArrowObjects.startAnchorX,
        startAnchorY: canvasArrowObjects.startAnchorY,
        endCollectionNodeId: canvasArrowObjects.endCollectionNodeId,
        endCanvasObjectId: canvasArrowObjects.endCanvasObjectId,
        endAnchorX: canvasArrowObjects.endAnchorX,
        endAnchorY: canvasArrowObjects.endAnchorY,
        arrowStyle: canvasArrowObjects.style,
        arrowPattern: canvasArrowObjects.pattern,
        arrowHead: canvasArrowObjects.head,
        arrowRouting: canvasArrowObjects.routing,
        arrowPoints: canvasArrowObjects.points,
        arrowRotation: canvasArrowObjects.rotation,
        arrowColor: canvasArrowObjects.color,
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
          eq(canvasObjects.collectionId, collectionId),
          parentFolderId === null
            ? isNull(canvasObjects.parentFolderId)
            : eq(canvasObjects.parentFolderId, parentFolderId),
        ),
      )
      .orderBy(canvasObjects.createdAt, canvasObjects.id);

    const collectionNodeIds = [
      ...new Set(
        rows.flatMap((row) =>
          [row.startCollectionNodeId, row.endCollectionNodeId].filter(
            (id): id is number => id !== null,
          ),
        ),
      ),
    ];
    const targetNodes =
      collectionNodeIds.length === 0
        ? []
        : await db
            .select({
              id: collectionNodes.id,
              nodeType: collectionNodes.nodeType,
              assetId: collectionNodes.assetId,
              folderId: collectionNodes.folderId,
            })
            .from(collectionNodes)
            .where(
              and(
                inArray(collectionNodes.id, collectionNodeIds),
                eq(collectionNodes.organizationId, orgId),
                eq(collectionNodes.collectionId, collectionId),
                parentFolderId === null
                  ? isNull(collectionNodes.parentFolderId)
                  : eq(collectionNodes.parentFolderId, parentFolderId),
              ),
            );

    // Asset type is encoded in the public ID, but collection_nodes deliberately
    // stores only the broad asset/folder kind. Resolve the concrete prefix in a
    // second lightweight query through the public parser's source tables.
    const nodeIdLookup = new Map<number, string>();
    for (const target of targetNodes) {
      if (target.nodeType === "folder") {
        nodeIdLookup.set(target.id, `folder-${target.folderId}`);
      }
    }
    const assetNodeIds = targetNodes
      .filter((target) => target.nodeType === "asset")
      .map((target) => target.id);
    if (assetNodeIds.length > 0) {
      const assetRows = await db
        .select({
          nodeId: collectionNodes.id,
          assetId: collectionNodes.assetId,
          assetType: assets.type,
        })
        .from(collectionNodes)
        .innerJoin(assets, eq(assets.id, collectionNodes.assetId))
        .where(inArray(collectionNodes.id, assetNodeIds));
      for (const target of assetRows) {
        nodeIdLookup.set(
          target.nodeId,
          `${target.assetType}-${target.assetId}`,
        );
      }
    }

    const canvasIdLookup = new Map(
      rows.map((row) => [row.id, `${row.objectType}-${row.id}`]),
    );
    const makeEndpoint = (
      position: { x: number; y: number },
      collectionNodeId: number | null,
      canvasObjectId: number | null,
      anchorX: number | null,
      anchorY: number | null,
    ): CanvasArrowObject["start"] => {
      const targetId = collectionNodeId
        ? nodeIdLookup.get(collectionNodeId)
        : canvasObjectId
          ? canvasIdLookup.get(canvasObjectId)
          : undefined;
      return {
        position,
        ...(targetId && anchorX !== null && anchorY !== null
          ? { binding: { targetId, anchor: { x: anchorX, y: anchorY } } }
          : {}),
      };
    };

    return rows.map((row): CanvasObject => {
      if (row.objectType === "text") {
        return {
          id: `text-${row.id}`,
          type: "text",
          content: row.content!,
          position: { x: row.positionX!, y: row.positionY! },
          font: row.font!,
          size: row.size!,
          color: row.textColor!,
          frontIndex: row.frontIndex,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }
      return {
        id: `arrow-${row.id}`,
        type: "arrow",
        start: makeEndpoint(
          { x: row.startX!, y: row.startY! },
          row.startCollectionNodeId,
          row.startCanvasObjectId,
          row.startAnchorX,
          row.startAnchorY,
        ),
        end: makeEndpoint(
          { x: row.endX!, y: row.endY! },
          row.endCollectionNodeId,
          row.endCanvasObjectId,
          row.endAnchorX,
          row.endAnchorY,
        ),
        style: row.arrowStyle!,
        pattern: row.arrowPattern!,
        head: row.arrowHead!,
        routing: row.arrowRouting!,
        points: row.arrowPoints!,
        rotation: row.arrowRotation!,
        color: row.arrowColor!,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async createText(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateCanvasTextInput,
  ): Promise<CanvasTextObject> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const parent = await resolveTargetInCollection(
      collection,
      data.parentFolderPath,
    );
    const row = await db.transaction(async (tx) => {
      const [object] = await tx
        .insert(canvasObjects)
        .values({
          organizationId: orgId,
          collectionId: collection.id,
          parentFolderId: parent.parentFolderId,
          objectType: "text",
          createdByUserId: userId,
          updatedByUserId: userId,
        })
        .returning();
      if (!object)
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create text");
      await tx.insert(canvasTextObjects).values({
        canvasObjectId: object.id,
        content: data.content,
        positionX: data.position.x,
        positionY: data.position.y,
        font: data.font,
        size: data.size,
        color: data.color,
      });
      return object;
    });
    return {
      id: `text-${row.id}`,
      type: "text",
      content: data.content,
      position: data.position,
      font: data.font,
      size: data.size,
      color: data.color,
      frontIndex: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createArrow(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateCanvasArrowInput,
  ): Promise<CanvasArrowObject> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const parentTarget = await resolveTargetInCollection(
      collection,
      data.parentFolderPath,
    );
    const parent = {
      collectionId: collection.id,
      parentFolderId: parentTarget.parentFolderId,
    };
    const [startBinding, endBinding] = await Promise.all([
      this.resolveBinding(orgId, parent, data.start.binding?.targetId),
      this.resolveBinding(orgId, parent, data.end.binding?.targetId),
    ]);
    const row = await db.transaction(async (tx) => {
      const [object] = await tx
        .insert(canvasObjects)
        .values({
          organizationId: orgId,
          collectionId: collection.id,
          parentFolderId: parent.parentFolderId,
          objectType: "arrow",
          createdByUserId: userId,
          updatedByUserId: userId,
        })
        .returning();
      if (!object)
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create arrow");
      await tx.insert(canvasArrowObjects).values({
        canvasObjectId: object.id,
        startX: data.start.position.x,
        startY: data.start.position.y,
        endX: data.end.position.x,
        endY: data.end.position.y,
        startCollectionNodeId: startBinding.collectionNodeId,
        startCanvasObjectId: startBinding.canvasObjectId,
        startAnchorX: data.start.binding?.anchor.x,
        startAnchorY: data.start.binding?.anchor.y,
        endCollectionNodeId: endBinding.collectionNodeId,
        endCanvasObjectId: endBinding.canvasObjectId,
        endAnchorX: data.end.binding?.anchor.x,
        endAnchorY: data.end.binding?.anchor.y,
        style: data.style,
        pattern: data.pattern,
        head: data.head,
        routing: data.routing,
        points: data.points,
        rotation: data.rotation,
        color: data.color,
      });
      return object;
    });
    return {
      id: `arrow-${row.id}`,
      type: "arrow",
      start: data.start,
      end: data.end,
      style: data.style,
      pattern: data.pattern,
      head: data.head,
      routing: data.routing,
      points: data.points,
      rotation: data.rotation,
      color: data.color,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateText(
    orgId: string,
    userId: string,
    collectionSlug: string,
    objectId: string,
    data: UpdateCanvasTextInput,
  ): Promise<CanvasTextObject> {
    const target = parseCanvasObjectId(objectId);
    if (target.type !== "text")
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Expected a text object");
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const existing = await this.requireObject(
      orgId,
      collection.id,
      target.id,
      "text",
    );
    await db.transaction(async (tx) => {
      await tx
        .update(canvasObjects)
        .set({ updatedByUserId: userId, updatedAt: new Date() })
        .where(eq(canvasObjects.id, target.id));
      await tx
        .update(canvasTextObjects)
        .set({
          content: data.content,
          positionX: data.position?.x,
          positionY: data.position?.y,
          font: data.font,
          size: data.size,
          color: data.color,
        })
        .where(eq(canvasTextObjects.canvasObjectId, target.id));
    });
    const object = (
      await this.getObjects(orgId, collection.id, existing.parentFolderId)
    ).find((candidate) => candidate.id === objectId);
    if (!object || object.type !== "text")
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update text");
    return object;
  }

  async updateArrow(
    orgId: string,
    userId: string,
    collectionSlug: string,
    objectId: string,
    data: UpdateCanvasArrowInput,
  ): Promise<CanvasArrowObject> {
    const target = parseCanvasObjectId(objectId);
    if (target.type !== "arrow")
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Expected an arrow object",
      );
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const existing = await this.requireObject(
      orgId,
      collection.id,
      target.id,
      "arrow",
    );
    const parent = {
      collectionId: collection.id,
      parentFolderId: existing.parentFolderId,
    };
    const [startBinding, endBinding] = await Promise.all([
      data.start
        ? this.resolveBinding(
            orgId,
            parent,
            data.start.binding?.targetId,
            target.id,
          )
        : undefined,
      data.end
        ? this.resolveBinding(
            orgId,
            parent,
            data.end.binding?.targetId,
            target.id,
          )
        : undefined,
    ]);
    await db.transaction(async (tx) => {
      await tx
        .update(canvasObjects)
        .set({ updatedByUserId: userId, updatedAt: new Date() })
        .where(eq(canvasObjects.id, target.id));
      await tx
        .update(canvasArrowObjects)
        .set({
          startX: data.start?.position.x,
          startY: data.start?.position.y,
          startCollectionNodeId: startBinding?.collectionNodeId,
          startCanvasObjectId: startBinding?.canvasObjectId,
          startAnchorX:
            data.start?.binding?.anchor.x ?? (data.start ? null : undefined),
          startAnchorY:
            data.start?.binding?.anchor.y ?? (data.start ? null : undefined),
          endX: data.end?.position.x,
          endY: data.end?.position.y,
          endCollectionNodeId: endBinding?.collectionNodeId,
          endCanvasObjectId: endBinding?.canvasObjectId,
          endAnchorX:
            data.end?.binding?.anchor.x ?? (data.end ? null : undefined),
          endAnchorY:
            data.end?.binding?.anchor.y ?? (data.end ? null : undefined),
          style: data.style,
          pattern: data.pattern,
          head: data.head,
          routing: data.routing,
          points: data.points,
          rotation: data.rotation,
          color: data.color,
        })
        .where(eq(canvasArrowObjects.canvasObjectId, target.id));
    });
    const object = (
      await this.getObjects(orgId, collection.id, existing.parentFolderId)
    ).find((candidate) => candidate.id === objectId);
    if (!object || object.type !== "arrow")
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update arrow");
    return object;
  }

  async deleteObject(orgId: string, collectionSlug: string, objectId: string) {
    const target = parseCanvasObjectId(objectId);
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const [deleted] = await db
      .delete(canvasObjects)
      .where(
        and(
          eq(canvasObjects.id, target.id),
          eq(canvasObjects.organizationId, orgId),
          eq(canvasObjects.collectionId, collection.id),
          eq(canvasObjects.objectType, target.type),
        ),
      )
      .returning({ id: canvasObjects.id });
    if (!deleted)
      throw new AppError(ErrorCode.NOT_FOUND, "Canvas object not found");
    return { deletedObjectId: objectId };
  }

  async deleteObjects(
    orgId: string,
    collectionSlug: string,
    objectIds: string[],
  ) {
    if (objectIds.length === 0) return 0;
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const targets = objectIds.map(parseCanvasObjectId);
    const textIds = targets
      .filter((target) => target.type === "text")
      .map((target) => target.id);
    const arrowIds = targets
      .filter((target) => target.type === "arrow")
      .map((target) => target.id);
    const typeCondition = or(
      textIds.length > 0
        ? and(
            eq(canvasObjects.objectType, "text"),
            inArray(canvasObjects.id, textIds),
          )
        : undefined,
      arrowIds.length > 0
        ? and(
            eq(canvasObjects.objectType, "arrow"),
            inArray(canvasObjects.id, arrowIds),
          )
        : undefined,
    );
    const deleted = await db
      .delete(canvasObjects)
      .where(
        and(
          eq(canvasObjects.organizationId, orgId),
          eq(canvasObjects.collectionId, collection.id),
          typeCondition,
        ),
      )
      .returning({ id: canvasObjects.id });
    return deleted.length;
  }

  private async requireObject(
    orgId: string,
    collectionId: number,
    id: number,
    type: "text" | "arrow",
  ) {
    const [object] = await db
      .select({ parentFolderId: canvasObjects.parentFolderId })
      .from(canvasObjects)
      .where(
        and(
          eq(canvasObjects.id, id),
          eq(canvasObjects.organizationId, orgId),
          eq(canvasObjects.collectionId, collectionId),
          eq(canvasObjects.objectType, type),
        ),
      )
      .limit(1);
    if (!object)
      throw new AppError(ErrorCode.NOT_FOUND, "Canvas object not found");
    return object;
  }

  private async resolveBinding(
    orgId: string,
    parent: CanvasParent,
    targetId?: string,
    excludedCanvasObjectId?: number,
  ): Promise<ResolvedBinding> {
    if (!targetId) return { collectionNodeId: null, canvasObjectId: null };
    if (/^(text|arrow)-/.test(targetId)) {
      const target = parseCanvasObjectId(targetId);
      if (target.id === excludedCanvasObjectId) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "An arrow cannot bind to itself",
        );
      }
      const [object] = await db
        .select({ id: canvasObjects.id })
        .from(canvasObjects)
        .where(
          and(
            eq(canvasObjects.id, target.id),
            eq(canvasObjects.organizationId, orgId),
            eq(canvasObjects.collectionId, parent.collectionId),
            eq(canvasObjects.objectType, target.type),
            parent.parentFolderId === null
              ? isNull(canvasObjects.parentFolderId)
              : eq(canvasObjects.parentFolderId, parent.parentFolderId),
          ),
        )
        .limit(1);
      if (!object)
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Arrow target is outside this canvas",
        );
      return { collectionNodeId: null, canvasObjectId: object.id };
    }

    const target = parseCollectionNodeId(targetId);
    const targetCondition =
      target.nodeType === "folder"
        ? and(
            eq(collectionNodes.nodeType, "folder"),
            eq(collectionNodes.folderId, target.entityId),
          )
        : and(
            eq(collectionNodes.nodeType, "asset"),
            eq(collectionNodes.assetId, target.entityId),
          );
    const [node] = await db
      .select({ id: collectionNodes.id })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.organizationId, orgId),
          eq(collectionNodes.collectionId, parent.collectionId),
          targetCondition,
          parent.parentFolderId === null
            ? isNull(collectionNodes.parentFolderId)
            : eq(collectionNodes.parentFolderId, parent.parentFolderId),
        ),
      )
      .limit(1);
    if (!node)
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Arrow target is outside this canvas",
      );
    return { collectionNodeId: node.id, canvasObjectId: null };
  }
}
