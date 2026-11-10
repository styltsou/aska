import {
  getCurrentSession,
  issueMediaSession,
  revokeMediaSession,
} from "@/controllers/session.controller";
import { factory } from "@/factory";

const sessionRoutes = factory
  .createApp()
  .get("/me", ...getCurrentSession)
  .post("/media/session/:workspaceSlug", ...issueMediaSession)
  .delete("/media/session", ...revokeMediaSession);

export default sessionRoutes;
