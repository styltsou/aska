import { factory } from "@/factory";

import sessionRoutes from "./session.routes";
import collectionRoutes from "./collection.routes";
import imageUploadRoutes from "./image-upload.routes";
import assetRoutes from "./asset.routes";
import imagePipelineRoutes from "./image-pipeline.routes";
import colorSearchRoutes from "./color-search.routes";
import pexelsRoutes from "./pexels.routes";
import resourcePipelineRoutes from "./resource-pipeline.routes";
import urlUnfurlRoutes from "./url-unfurl.routes";
import noteMentionRoutes from "./note-mention.routes";
import workspaceSearchRoutes from "./workspace-search.routes";
import videoUploadRoutes from "./video-upload.routes";
import videoPipelineRoutes from "./video-pipeline.routes";
import extensionAuthRoutes from "./extension-auth.routes";
import mediaResolutionRoutes from "./media-resolution.routes";

export const apiRoutes = factory
  .createApp()
  .route("/", sessionRoutes)
  .route("/", collectionRoutes)
  .route("/", noteMentionRoutes)
  .route("/", workspaceSearchRoutes)
  .route("/", assetRoutes)
  .route("/", colorSearchRoutes)
  .route("/", imageUploadRoutes)
  .route("/", videoUploadRoutes)
  .route("/", mediaResolutionRoutes)
  .route("/", extensionAuthRoutes)
  .route("/", videoPipelineRoutes)
  .route("/", pexelsRoutes)
  .route("/", imagePipelineRoutes)
  .route("/", urlUnfurlRoutes)
  .route("/", resourcePipelineRoutes);
