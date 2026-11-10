import { factory } from "@/factory";
import {
  claimGradientNaming,
  completeGradientNaming,
  failGradientNaming,
} from "@/controllers/gradient-naming-pipeline.controller";

export default factory
  .createApp()
  .post("/internal/gradient-naming/claim", ...claimGradientNaming)
  .post("/internal/gradient-naming/result", ...completeGradientNaming)
  .post("/internal/gradient-naming/failure", ...failGradientNaming);
