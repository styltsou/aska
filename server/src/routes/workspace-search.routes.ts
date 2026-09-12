import { searchWorkspace } from "@/controllers/workspace-search.controller";
import { factory } from "@/factory";

export default factory
  .createApp()
  .get("/workspace/:workspaceSlug/search", ...searchWorkspace);
