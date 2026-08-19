import { container } from "@/container";
import {
  CollectionPathParamSchema,
  WorkspaceParamSchema,
} from "@/dto/collection.dto";
import {
  CreateLinkSchema,
  LinkAssetPathParamSchema,
} from "@/dto/url-unfurl.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";

export const createCollectionLink = factory.createHandlers(
  authMiddleware,
  validate.param(CollectionPathParamSchema),
  validate.body(CreateLinkSchema),
  async (c) => {
    const { workspaceSlug, collectionSlug } = c.req.valid("param");
    const workspace = await container.collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    const link = await container.urlUnfurlService.createCollectionLink(
      workspace.id,
      c.get("userId"),
      collectionSlug,
      c.req.valid("json"),
    );
    return c.json(success({ link }), 201);
  },
);

export const createInboxLink = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(CreateLinkSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const workspace = await container.collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    const link = await container.urlUnfurlService.createInboxLink(
      workspace.id,
      c.get("userId"),
      c.req.valid("json"),
    );
    return c.json(success({ link }), 201);
  },
);

export const refreshLink = factory.createHandlers(
  authMiddleware,
  validate.param(LinkAssetPathParamSchema),
  async (c) => {
    const { workspaceSlug, assetId } = c.req.valid("param");
    const workspace = await container.collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    const link = await container.urlUnfurlService.refreshLink(
      workspace.id,
      assetId,
    );
    return c.json(success({ link }), 202);
  },
);
