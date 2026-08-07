import {
  AssetPathParamSchema,
  ContentTypeQuerySchema,
  CreateNoteSchema,
  WorkspaceParamSchema,
} from "@/dto/collection.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";

import { container } from "@/container";
import type { IAssetService } from "@/services/asset.service";
import type { ICollectionService } from "@/services/collection.service";

const assetService: IAssetService = container.assetService;
const collectionService: ICollectionService = container.collectionService;

export const getInboxContents = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.query(ContentTypeQuerySchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const { types } = c.req.valid("query");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const contents = await assetService.getInboxContents(workspace.id, types);

    return c.json(success(contents));
  },
);

export const createInboxNote = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateNoteSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const note = await assetService.createInboxNote(workspace.id, userId, data);

    return c.json(success({ note }), 201);
  },
);

export const markInboxSeen = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const inbox = await assetService.markInboxSeen(workspace.id, userId);

    return c.json(success(inbox));
  },
);

export const deleteAsset = factory.createHandlers(
  authMiddleware,
  validate.param(AssetPathParamSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const result = await assetService.deleteAsset(workspace.id, assetId);

    return c.json(success(result));
  },
);

export const downloadAsset = factory.createHandlers(
  authMiddleware,
  validate.param(AssetPathParamSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const { bytes, contentType, filename } = await assetService.downloadAsset(
      workspace.id,
      assetId,
    );

    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
    });
  },
);
