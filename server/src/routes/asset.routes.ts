import {
  createInboxNote,
  deleteAsset,
  getInboxContents,
  markInboxSeen,
  placeAsset,
} from "@/controllers/asset.controller";
import { factory } from "@/factory";

const assetRoutes = factory
  .createApp()
  .get("/workspace/:workspaceSlug/inbox", ...getInboxContents)
  .post("/workspace/:workspaceSlug/inbox/seen", ...markInboxSeen)
  .post("/workspace/:workspaceSlug/inbox/notes", ...createInboxNote)
  .post("/workspace/:workspaceSlug/assets/:assetId/placements", ...placeAsset)
  .delete("/workspace/:workspaceSlug/assets/:assetId", ...deleteAsset);

export default assetRoutes;
