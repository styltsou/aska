import { searchUnsplash } from "@/controllers/unsplash.controller";
import { factory } from "@/factory";

const unsplashRoutes = factory
  .createApp()
  .get("/workspace/:workspaceSlug/unsplash/search", ...searchUnsplash);

export default unsplashRoutes;
