import {
  createInboxDirectImageUpload,
  createInboxImageFromRemoteUrl,
  createImageFromRemoteUrl,
  createDirectImageUpload,
  getDirectImageUploadStatus,
  getInboxImageUploadStatus,
} from "@/controllers/image-upload.controller";
import { factory } from "@/factory";

const imageUploadRoutes = factory
  .createApp()
  .post(
    "/workspace/:workspaceSlug/inbox/images/uploads",
    ...createInboxDirectImageUpload,
  )
  .get(
    "/workspace/:workspaceSlug/inbox/images/uploads/:uploadId",
    ...getInboxImageUploadStatus,
  )
  .post(
    "/workspace/:workspaceSlug/inbox/images/remote",
    ...createInboxImageFromRemoteUrl,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/images/uploads",
    ...createDirectImageUpload,
  )
  .get(
    "/workspace/:workspaceSlug/collections/:collectionSlug/images/uploads/:uploadId",
    ...getDirectImageUploadStatus,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/images/remote",
    ...createImageFromRemoteUrl,
  );

export default imageUploadRoutes;
