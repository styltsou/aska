import {
  createCollectionLink,
  createInboxLink,
  getLinkResolutionStatus,
  refreshLink,
} from "@/controllers/url-unfurl.controller";
import { factory } from "@/factory";

const routes = factory
  .createApp()
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/links",
    ...createCollectionLink,
  )
  .post("/workspace/:workspaceSlug/inbox/links", ...createInboxLink)
  .get(
    "/workspace/:workspaceSlug/links/:assetId/status",
    ...getLinkResolutionStatus,
  )
  .post("/workspace/:workspaceSlug/links/:assetId/resolution", ...refreshLink);

export default routes;
