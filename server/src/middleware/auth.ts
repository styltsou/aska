import { setCookie } from "hono/cookie";

import { env } from "@/config";
import { auth } from "@/lib/auth";
import { createCloudFrontSignedCookies } from "@/lib/cloudfront-signed-cookies";
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

  if (
    env.MEDIA_BASE_URL &&
    env.CLOUDFRONT_KEY_PAIR_ID &&
    env.CLOUDFRONT_PRIVATE_KEY_BASE64 &&
    env.CLOUDFRONT_COOKIE_DOMAIN
  ) {
    for (const cookie of createCloudFrontSignedCookies({
      mediaBaseUrl: env.MEDIA_BASE_URL,
      publicKeyId: env.CLOUDFRONT_KEY_PAIR_ID,
      privateKeyBase64: env.CLOUDFRONT_PRIVATE_KEY_BASE64,
      expiresInSeconds: env.CLOUDFRONT_SIGNED_COOKIE_EXPIRES_SECONDS,
    })) {
      setCookie(c, cookie.name, cookie.value, {
        domain: env.CLOUDFRONT_COOKIE_DOMAIN,
        httpOnly: true,
        path: "/",
        secure: true,
        sameSite: "lax",
      });
    }
  }
});
