import { handleImagePipelineCallback } from "@/controllers/image-pipeline.controller";
import { factory } from "@/factory";

const imagePipelineRoutes = factory
  .createApp()
  .post("/internal/image-pipeline/callback", ...handleImagePipelineCallback);

export default imagePipelineRoutes;
