import {
  createInboxNote,
  createInboxColor,
  cropImage,
  deleteAsset,
  downloadAsset,
  getInboxContents,
  markInboxSeen,
  updateNote,
} from "@/controllers/asset.controller";
import { factory } from "@/factory";

const assetRoutes = factory
  .createApp()
  .get("/workspace/:workspaceSlug/inbox", ...getInboxContents)
  .post("/workspace/:workspaceSlug/inbox/seen", ...markInboxSeen)
  .post("/workspace/:workspaceSlug/inbox/notes", ...createInboxNote)
  .post("/workspace/:workspaceSlug/inbox/colors", ...createInboxColor)
  .patch("/workspace/:workspaceSlug/assets/:assetId/note", ...updateNote)
  .post("/workspace/:workspaceSlug/images/:assetId/crop", ...cropImage)
  .delete("/workspace/:workspaceSlug/assets/:assetId", ...deleteAsset)
  .get("/workspace/:workspaceSlug/assets/:assetId/download", ...downloadAsset);

export default assetRoutes;
