import {
  claimRemoteVideoImport,
  handleVideoPipelineCallback,
} from "@/controllers/video-pipeline.controller";
import { factory } from "@/factory";
export default factory
  .createApp()
  .post("/internal/video-pipeline/callback", ...handleVideoPipelineCallback)
  .post("/internal/video-pipeline/claim", ...claimRemoteVideoImport);
