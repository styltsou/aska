import {
  AssetPathParamSchema,
  CropInputSchema,
  ContentTypeQuerySchema,
  CreateNoteSchema,
  CreateColorSchema,
  ImageCropPathParamSchema,
  UpdateImageSchema,
  UpdateLinkSchema,
  UpdateNoteSchema,
  UpdateColorSchema,
  WorkspaceParamSchema,
} from "@/dto/collection.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";

import { container } from "@/container";
import type { IAssetService } from "@/services/asset.service";
import type { IImageCropService } from "@/services/image-crop.service";
import type { ICollectionService } from "@/services/collection.service";

const assetService: IAssetService = container.assetService;
const collectionService: ICollectionService = container.collectionService;
const imageCropService: IImageCropService = container.imageCropService;

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

export const getPeekableAsset = factory.createHandlers(
  authMiddleware,
  validate.param(AssetPathParamSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success({
        asset: await assetService.getPeekableAsset(workspace.id, assetId),
      }),
    );
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

export const createInboxColor = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateColorSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const color = await assetService.createInboxColor(
      workspace.id,
      userId,
      data,
    );
    return c.json(success({ color }), 201);
  },
);

export const updateNote = factory.createHandlers(
  authMiddleware,
  validate.param(AssetPathParamSchema),
  validate.body(UpdateNoteSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const note = await assetService.updateNote(
      workspace.id,
      userId,
      assetId,
      data,
    );

    return c.json(success({ note }));
  },
);

export const updateColor = factory.createHandlers(
  authMiddleware,
  validate.param(AssetPathParamSchema),
  validate.body(UpdateColorSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const color = await assetService.updateColor(
      workspace.id,
      userId,
      assetId,
      data,
    );
    return c.json(success({ color }));
  },
);

export const updateImage = factory.createHandlers(
  authMiddleware,
  validate.param(AssetPathParamSchema),
  validate.body(UpdateImageSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const image = await assetService.updateImage(
      workspace.id,
      userId,
      assetId,
      data,
    );
    return c.json(success({ image }));
  },
);

export const updateLink = factory.createHandlers(
  authMiddleware,
  validate.param(AssetPathParamSchema),
  validate.body(UpdateLinkSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const link = await assetService.updateLink(
      workspace.id,
      userId,
      assetId,
      data,
    );
    return c.json(success({ link }));
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

export const cropImage = factory.createHandlers(
  authMiddleware,
  validate.param(ImageCropPathParamSchema),
  validate.body(CropInputSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const { crop, transform } = c.req.valid("json");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success(
        await imageCropService.crop(
          workspace.id,
          c.get("userId"),
          assetId,
          crop,
          transform,
        ),
      ),
    );
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
      c.req.raw.signal,
    );

    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
    });
  },
);
