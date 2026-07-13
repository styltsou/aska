import { container } from "@/container";
import { CollectionPathParamSchema } from "@/dto/collection.dto";
import {
  CreateImageUploadSchema,
  CreateRemoteImageSchema,
  InboxUploadPathParamSchema,
  UploadPathParamSchema,
} from "@/dto/upload.dto";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import type { ICollectionService } from "@/services/collection.service";
import type { IImageUploadService } from "@/services/image-upload.service";

const collectionService: ICollectionService =
  container.cradle.collectionService;
const imageUploadService: IImageUploadService =
  container.cradle.imageUploadService;

export const createDirectImageUpload = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateImageUploadSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const upload = await imageUploadService.createDirectImageUpload(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );

    return c.json(success({ upload }), 201);
  },
);

export const createImageFromRemoteUrl = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateRemoteImageSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const upload = await imageUploadService.createImageFromRemoteUrl(
      workspace.id,
      userId,
      collectionSlug,
      data,
    );

    return c.json(success({ upload }), 202);
  },
);

export const createInboxDirectImageUpload = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateImageUploadSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const upload = await imageUploadService.createInboxDirectImageUpload(
      workspace.id,
      userId,
      data,
    );

    return c.json(success({ upload }), 201);
  },
);

export const createInboxImageFromRemoteUrl = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateRemoteImageSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");

    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const upload = await imageUploadService.createInboxImageFromRemoteUrl(
      workspace.id,
      userId,
      data,
    );

    return c.json(success({ upload }), 202);
  },
);

export const getDirectImageUploadStatus = factory.createHandlers(
  authMiddleware,
  validate.param(UploadPathParamSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, uploadId } = c.req.valid("param");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const upload = await imageUploadService.getDirectImageUploadStatus(
      workspace.id,
      collectionSlug,
      uploadId,
    );
    return c.json(success({ upload }));
  },
);

export const getInboxImageUploadStatus = factory.createHandlers(
  authMiddleware,
  validate.param(InboxUploadPathParamSchema),
  async (c) => {
    const { workspaceSlug, uploadId } = c.req.valid("param");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const upload = await imageUploadService.getInboxImageUploadStatus(
      workspace.id,
      uploadId,
    );
    return c.json(success({ upload }));
  },
);
