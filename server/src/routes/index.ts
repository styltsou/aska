import { factory } from "@/factory";

import sessionRoutes from "./session.routes";
import collectionRoutes from "./collection.routes";
import imageUploadRoutes from "./image-upload.routes";
import assetRoutes from "./asset.routes";
import imagePipelineRoutes from "./image-pipeline.routes";
import colorSearchRoutes from "./color-search.routes";

export const apiRoutes = factory
  .createApp()
  .route("/", sessionRoutes)
  .route("/", collectionRoutes)
  .route("/", assetRoutes)
  .route("/", colorSearchRoutes)
  .route("/", imageUploadRoutes)
  .route("/", imagePipelineRoutes);
