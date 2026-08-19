import {
  createCollectionLink,
  createInboxLink,
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
  .post("/workspace/:workspaceSlug/links/:assetId/resolution", ...refreshLink);

export default routes;
