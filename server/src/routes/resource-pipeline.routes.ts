import {
  claimResourceMedia,
  claimUrlResolution,
  reportResourceMedia,
  reportUrlResolution,
} from "@/controllers/resource-pipeline.controller";
import { factory } from "@/factory";

const routes = factory
  .createApp()
  .post("/internal/url-resolution/claim", ...claimUrlResolution)
  .post("/internal/url-resolution/result", ...reportUrlResolution)
  .post("/internal/resource-media/claim", ...claimResourceMedia)
  .post("/internal/resource-media/result", ...reportResourceMedia);

export default routes;
