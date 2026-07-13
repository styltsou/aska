import {
  CollectionNodePathParamSchema,
  CollectionPathParamSchema,
  CreateCollectionSchema,
  CreateFolderSchema,
  CreateNoteSchema,
  FolderPathQuerySchema,
  WorkspaceParamSchema,
} from "@/dto/collection.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";

import { container } from "@/container";
import type { ICollectionService } from "@/services/collection.service";

const collectionService: ICollectionService =
  container.cradle.collectionService;

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
    const collections = await collectionService.getLightCollections(
      workspace.id,
    );

    return c.json(
      success({
        workspace,
        collections,
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

export const getCollectionContents = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.query(FolderPathQuerySchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const { folderPath } = c.req.valid("query");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const contents = await collectionService.getCollectionContents(
      workspace.id,
      collectionSlug,
      folderPath,
    );

    return c.json(success(contents));
  },
);
