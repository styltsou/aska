import * as Sentry from "@sentry/hono/node";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { AppError, ErrorCode } from "@/lib/errors";

import { factory } from "@/factory";

type VerifiedApiKey = {
  referenceId?: string;
  userId?: string;
};

async function authenticateApiKey(key: string) {
  const result = (await auth.api.verifyApiKey({
    body: { key },
  })) as { valid?: boolean; key?: VerifiedApiKey };

  const userId = result.key?.referenceId ?? result.key?.userId;
  if (!result.valid || !userId) return null;

  const [authenticatedUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return authenticatedUser ?? null;
}

export const authMiddleware = factory.createMiddleware(async (c, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (apiKey) {
    const authenticatedUser = await authenticateApiKey(apiKey);

    if (!authenticatedUser) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized");
    }

    c.set("authSession", null);
    c.set("user", authenticatedUser);
    c.set("userId", authenticatedUser.id);
    c.set("activeOrganizationId", null);
    Sentry.setUser({ id: authenticatedUser.id });

    await next();
    return;
  }

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
