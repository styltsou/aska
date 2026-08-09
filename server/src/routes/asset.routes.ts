import {
  createInboxNote,
  cropImage,
  deleteAsset,
  downloadAsset,
  getInboxContents,
  markInboxSeen,
  redoCropOperation,
  undoCropOperation,
} from "@/controllers/asset.controller";
import { factory } from "@/factory";

const assetRoutes = factory
  .createApp()
  .get("/workspace/:workspaceSlug/inbox", ...getInboxContents)
  .post("/workspace/:workspaceSlug/inbox/seen", ...markInboxSeen)
  .post("/workspace/:workspaceSlug/inbox/notes", ...createInboxNote)
  .post("/workspace/:workspaceSlug/images/:assetId/crop", ...cropImage)
  .post(
    "/workspace/:workspaceSlug/crop-operations/:operationId/undo",
    ...undoCropOperation,
  )
  .post(
    "/workspace/:workspaceSlug/crop-operations/:operationId/redo",
    ...redoCropOperation,
  )
  .delete("/workspace/:workspaceSlug/assets/:assetId", ...deleteAsset)
  .get("/workspace/:workspaceSlug/assets/:assetId/download", ...downloadAsset);

export default assetRoutes;
