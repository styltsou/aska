import { searchImagesByColor } from "@/controllers/color-search.controller";
import { factory } from "@/factory";

const colorSearchRoutes = factory
  .createApp()
  .post("/workspace/:workspaceSlug/images/search", ...searchImagesByColor);

export default colorSearchRoutes;
