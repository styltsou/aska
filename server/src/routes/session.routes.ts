import { getCurrentSession } from "@/controllers/session.controller";
import { factory } from "@/factory";

const sessionRoutes = factory.createApp().get("/me", ...getCurrentSession);

export default sessionRoutes;
