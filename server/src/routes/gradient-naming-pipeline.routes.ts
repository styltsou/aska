import { factory } from "@/factory";
import {
  claimGradientNaming,
  completeGradientNaming,
} from "@/controllers/gradient-naming-pipeline.controller";

export default factory
  .createApp()
  .post("/internal/gradient-naming/claim", ...claimGradientNaming)
  .post("/internal/gradient-naming/result", ...completeGradientNaming);
