import {
  getNoteBacklinkSummary,
  listNoteBacklinks,
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
  )
  .get(
    "/workspace/:workspaceSlug/assets/:assetId/backlinks/summary",
    ...getNoteBacklinkSummary,
  )
  .get(
    "/workspace/:workspaceSlug/assets/:assetId/backlinks",
    ...listNoteBacklinks,
  );

export default noteMentionRoutes;
