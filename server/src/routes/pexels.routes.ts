import { searchPexels } from "@/controllers/pexels.controller";
import { factory } from "@/factory";

const pexelsRoutes = factory
  .createApp()
  .get("/workspace/:workspaceSlug/pexels/search", ...searchPexels);

export default pexelsRoutes;
