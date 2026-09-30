import { container } from "@/container";
import {
  CollectionPathParamSchema,
  WorkspaceParamSchema,
} from "@/dto/collection.dto";
import {
  CreateRemoteVideoSchema,
  CreateVideoUploadSchema,
  InboxUploadPathParamSchema,
  UploadPathParamSchema,
} from "@/dto/upload.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";

const videos = container.videoUploadService;
const collections = container.collectionService;

export const createDirectVideoUpload = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateVideoUploadSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const userId = c.get("userId");
    const workspace = await collections.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    return c.json(
      success({
        upload: await videos.createDirect(
          workspace.id,
          userId,
          collectionSlug,
          c.req.valid("json"),
        ),
      }),
      201,
    );
  },
);
export const createInboxDirectVideoUpload = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateVideoUploadSchema),
  async (c) => {
    const userId = c.get("userId");
    const workspace = await collections.getWorkspaceBySlug(
      c.req.valid("param").workspaceSlug,
      userId,
    );
    return c.json(
      success({
        upload: await videos.createDirect(
          workspace.id,
          userId,
          null,
          c.req.valid("json"),
        ),
      }),
      201,
    );
  },
);
export const createRemoteVideo = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateRemoteVideoSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const userId = c.get("userId");
    const workspace = await collections.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    return c.json(
      success({
        upload: await videos.createRemote(
          workspace.id,
          userId,
          collectionSlug,
          c.req.valid("json"),
        ),
      }),
      202,
    );
  },
);
export const createInboxRemoteVideo = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateRemoteVideoSchema),
  async (c) => {
    const userId = c.get("userId");
    const workspace = await collections.getWorkspaceBySlug(
      c.req.valid("param").workspaceSlug,
      userId,
    );
    return c.json(
      success({
        upload: await videos.createRemote(
          workspace.id,
          userId,
          null,
          c.req.valid("json"),
        ),
      }),
      202,
    );
  },
);
export const getDirectVideoUploadStatus = factory.createHandlers(
  authMiddleware,
  validate.param(UploadPathParamSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, uploadId } = c.req.valid("param");
    const workspace = await collections.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success({
        upload: await videos.status(workspace.id, collectionSlug, uploadId),
      }),
    );
  },
);
export const getInboxVideoUploadStatus = factory.createHandlers(
  authMiddleware,
  validate.param(InboxUploadPathParamSchema),
  async (c) => {
    const { workspaceSlug, uploadId } = c.req.valid("param");
    const workspace = await collections.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success({ upload: await videos.status(workspace.id, null, uploadId) }),
    );
  },
);

export const failDirectVideoUpload = factory.createHandlers(
  authMiddleware,
  validate.param(UploadPathParamSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug, uploadId } = c.req.valid("param");
    const workspace = await collections.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success({
        upload: await videos.markClientFailure(
          workspace.id,
          collectionSlug,
          uploadId,
        ),
      }),
    );
  },
);

export const failInboxDirectVideoUpload = factory.createHandlers(
  authMiddleware,
  validate.param(InboxUploadPathParamSchema),
  async (c) => {
    const { workspaceSlug, uploadId } = c.req.valid("param");
    const workspace = await collections.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success({
        upload: await videos.markClientFailure(workspace.id, null, uploadId),
      }),
    );
  },
);
