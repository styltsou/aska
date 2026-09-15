import { parseCollectionNodeId } from "@/lib/collection-node-id";

import {
  BulkDeleteBodySchema,
  CanvasObjectPathParamSchema,
  CollectionNodePathParamSchema,
  FolderNodePathParamSchema,
  CollectionPathParamSchema,
  CreateCollectionSchema,
  CreateCanvasArrowSchema,
  CreateCanvasTextSchema,
  CreateColorSchema,
  CreateFolderSchema,
  CreateNoteSchema,
  CollectionContentsQuerySchema,
  MoveCollectionNodesParentSchema,
  WorkspaceParamSchema,
  UpdateNodePositionSchema,
  UpdateNodePositionsSchema,
  UpdateCanvasArrowSchema,
  UpdateCanvasTextSchema,
  UpdateCanvasItemFrontIndexesSchema,
} from "@/dto/collection.dto";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";

import { container } from "@/container";
import type { IAssetService } from "@/services/asset.service";
import type { ICollectionService } from "@/services/collection.service";

const collectionService: ICollectionService = container.collectionService;
const assetService: IAssetService = container.assetService;

export const getWorkspaceWithCollections = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const [collections, inbox] = await Promise.all([
      collectionService.getLightCollections(workspace.id),
      assetService.getInboxStatus(workspace.id, userId),
    ]);

    return c.json(
      success({
        workspace,
        collections,
        inbox,
      }),
    );
  },
);

export const getCollections = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const collections = await collectionService.getDetailedCollections(
      workspace.id,
    );

    return c.json(success({ collections }));
  },
);

export const createCollection = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateCollectionSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const collection = await collectionService.createCollection(
      workspace.id,
      userId,
      data,
    );

    return c.json(
      success({
        collection: {
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          createdAt: collection.createdAt.toISOString(),
          updatedAt: collection.updatedAt.toISOString(),
        },
      }),
      201,
    );
  },
);

export const createFolder = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateFolderSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const folder = await collectionService.createFolder(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );

    return c.json(success({ folder }), 201);
  },
);

export const createNote = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateNoteSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const note = await collectionService.createNote(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );

    return c.json(success({ note }), 201);
  },
);

export const createColor = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateColorSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const color = await collectionService.createColor(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );

    return c.json(success({ color }), 201);
  },
);

export const createCanvasText = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateCanvasTextSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const object = await collectionService.createCanvasText(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );
    return c.json(success({ object }), 201);
  },
);

export const createCanvasArrow = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateCanvasArrowSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const object = await collectionService.createCanvasArrow(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );
    return c.json(success({ object }), 201);
  },
);

export const updateCanvasText = factory.createHandlers(
  authMiddleware,
  validate.param(CanvasObjectPathParamSchema),
  validate.body(UpdateCanvasTextSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, objectId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const object = await collectionService.updateCanvasText(
      workspace.id,
      userId,
      collectionSlug,
      objectId,
      data,
    );
    return c.json(success({ object }));
  },
);

export const updateCanvasArrow = factory.createHandlers(
  authMiddleware,
  validate.param(CanvasObjectPathParamSchema),
  validate.body(UpdateCanvasArrowSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, objectId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const object = await collectionService.updateCanvasArrow(
      workspace.id,
      userId,
      collectionSlug,
      objectId,
      data,
    );
    return c.json(success({ object }));
  },
);

export const updateCanvasItemFrontIndexes = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(UpdateCanvasItemFrontIndexesSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.bringCanvasItemsToFront(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );
    return c.json(success(result));
  },
);

export const deleteCanvasObject = factory.createHandlers(
  authMiddleware,
  validate.param(CanvasObjectPathParamSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, objectId } = c.req.valid("param");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.deleteCanvasObject(
      workspace.id,
      collectionSlug,
      objectId,
    );
    return c.json(success(result));
  },
);

export const deleteCollectionNode = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionNodePathParamSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, nodeId } = c.req.valid("param");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.deleteNode(
      workspace.id,
      collectionSlug,
      nodeId,
    );

    return c.json(success(result));
  },
);

export const deleteCollection = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.deleteCollection(
      workspace.id,
      collectionSlug,
    );

    return c.json(success(result));
  },
);

export const updateCollectionNodePosition = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionNodePathParamSchema),
  validate.body(UpdateNodePositionSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, nodeId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.updateNodePosition(
      workspace.id,
      collectionSlug,
      nodeId,
      data,
    );

    return c.json(success(result));
  },
);

export const updateCollectionNodePositions = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(UpdateNodePositionsSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.updateNodePositions(
      workspace.id,
      collectionSlug,
      data,
    );

    return c.json(success(result));
  },
);

export const moveCollectionNodesToFolder = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(MoveCollectionNodesParentSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.moveNodesToFolder(
      workspace.id,
      collectionSlug,
      data,
    );

    return c.json(success(result));
  },
);

export const flattenFolder = factory.createHandlers(
  authMiddleware,
  validate.param(FolderNodePathParamSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, nodeId } = c.req.valid("param");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await collectionService.flattenFolder(
      workspace.id,
      collectionSlug,
      nodeId,
    );
    return c.json(success(result));
  },
);

export const bulkDelete = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(BulkDeleteBodySchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const { nodeIds, collectionSlug } = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );

    const folderIds: number[] = [];
    const assetNodeIds: string[] = [];
    const canvasObjectIds: string[] = [];

    for (const nodeId of nodeIds) {
      if (/^(text|arrow)-\d+$/.test(nodeId)) {
        canvasObjectIds.push(nodeId);
        continue;
      }
      const target = parseCollectionNodeId(nodeId);
      if (target.nodeType === "folder") {
        folderIds.push(target.entityId);
      } else {
        assetNodeIds.push(nodeId);
      }
    }

    let deletedCount = 0;
    let deletedAssetCount = 0;

    if (canvasObjectIds.length > 0) {
      if (!collectionSlug) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "collectionSlug is required when deleting canvas objects",
        );
      }
      deletedCount += await collectionService.deleteCanvasObjects(
        workspace.id,
        collectionSlug,
        canvasObjectIds,
      );
    }

    if (folderIds.length > 0) {
      if (!collectionSlug) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "collectionSlug is required when deleting folders",
        );
      }
      deletedAssetCount += await collectionService.deleteFolders(
        workspace.id,
        collectionSlug,
        folderIds,
      );
      deletedCount += folderIds.length;
    }

    if (assetNodeIds.length > 0) {
      const result = await assetService.bulkDeleteAssets(
        workspace.id,
        assetNodeIds,
      );
      deletedCount += result.deletedCount;
      deletedAssetCount += result.deletedAssetCount;
    }

    return c.json(success({ deletedCount, deletedAssetCount }));
  },
);

export const getCollectionContents = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.query(CollectionContentsQuerySchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const { folderPath, types } = c.req.valid("query");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const contents = await collectionService.getCollectionContents(
      workspace.id,
      collectionSlug,
      folderPath,
      types,
    );

    return c.json(success(contents));
  },
);
