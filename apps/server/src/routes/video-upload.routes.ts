import { factory } from "@/factory";
import {
  createDirectVideoUpload,
  createInboxDirectVideoUpload,
  createInboxRemoteVideo,
  createRemoteVideo,
  failDirectVideoUpload,
  failInboxDirectVideoUpload,
  getDirectVideoUploadStatus,
  getInboxVideoUploadStatus,
} from "@/controllers/video-upload.controller";

export default factory
  .createApp()
  .post(
    "/workspace/:workspaceSlug/inbox/videos/uploads",
    ...createInboxDirectVideoUpload,
  )
  .get(
    "/workspace/:workspaceSlug/inbox/videos/uploads/:uploadId",
    ...getInboxVideoUploadStatus,
  )
  .post(
    "/workspace/:workspaceSlug/inbox/videos/uploads/:uploadId/fail",
    ...failInboxDirectVideoUpload,
  )
  .post(
    "/workspace/:workspaceSlug/inbox/videos/remote",
    ...createInboxRemoteVideo,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/videos/uploads",
    ...createDirectVideoUpload,
  )
  .get(
    "/workspace/:workspaceSlug/collections/:collectionSlug/videos/uploads/:uploadId",
    ...getDirectVideoUploadStatus,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/videos/uploads/:uploadId/fail",
    ...failDirectVideoUpload,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/videos/remote",
    ...createRemoteVideo,
  );
