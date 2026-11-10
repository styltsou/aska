import * as Sentry from "@sentry/hono/node";

import { auth } from "@/lib/auth";
import { AppError, ErrorCode } from "@/lib/errors";

import { factory } from "@/factory";

export const authMiddleware = factory.createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  // Better Auth normally returns null for an expired or invalid cookie. Guard
  // the nested values as well so a race with session/user cleanup becomes a
  // normal 401 rather than an unhandled TypeError.
  if (!session?.session || !session.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized");
  }

  c.set("authSession", session.session);
  c.set("user", session.user);
  c.set("userId", session.user.id);
  c.set("activeOrganizationId", session.session.activeOrganizationId ?? null);
  Sentry.setUser({ id: session.user.id });

  await next();
});
