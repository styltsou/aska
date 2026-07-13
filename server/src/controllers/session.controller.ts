import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";

export const getCurrentSession = factory.createHandlers(
  authMiddleware,
  async (c) => {
    return c.json(
      success({
        user: c.get("user"),
        session: c.get("authSession"),
        activeOrganizationId: c.get("activeOrganizationId"),
      }),
    );
  },
);
