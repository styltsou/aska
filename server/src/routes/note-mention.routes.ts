import {
  resolveNoteMentions,
  searchNoteMentions,
} from "@/controllers/note-mention.controller";
import { factory } from "@/factory";

const noteMentionRoutes = factory
  .createApp()
  .get("/workspace/:workspaceSlug/assets/mention-search", ...searchNoteMentions)
  .post(
    "/workspace/:workspaceSlug/assets/mention-resolve",
    ...resolveNoteMentions,
  );

export default noteMentionRoutes;
