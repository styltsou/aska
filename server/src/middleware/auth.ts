import { auth } from "@/lib/auth";
import { AppError, ErrorCode } from "@/lib/errors";

import { factory } from "@/factory";

export const authMiddleware = factory.createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized");
  }

  c.set("authSession", session.session);
  c.set("user", session.user);
  c.set("userId", session.user.id);
  c.set("activeOrganizationId", session.session.activeOrganizationId ?? null);

  await next();
});
