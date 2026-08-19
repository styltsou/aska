import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { env } from "@/config";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";

const HMAC_AUTHENTICATED_PIPELINE_PATHS = new Set([
  "/api/v1/internal/image-pipeline/callback",
  "/api/v1/internal/url-resolution/claim",
  "/api/v1/internal/url-resolution/result",
  "/api/v1/internal/resource-media/claim",
  "/api/v1/internal/resource-media/result",
]);

let jwks: JWTVerifyGetKey | undefined;
let jwksTeamDomain: string | undefined;

export const cloudflareAccess = factory.createMiddleware(async (c, next) => {
  // The personal/local stage has no Access application. In the stable cloud
  // stage both settings are required by the deployment config.
  if (!env.CLOUDFLARE_ACCESS_AUD || !env.CLOUDFLARE_ACCESS_TEAM_DOMAIN) {
    return next();
  }

  // Browsers deliberately omit cookies from CORS preflights. Cloudflare Access
  // answers those OPTIONS requests using its configured CORS response; Hono
  // still validates the actual credentialed request. Image workers instead
  // authenticate these explicitly allowlisted pipeline callbacks with HMAC
  // secrets and replay checks. Do not replace this with an /internal wildcard.
  if (
    c.req.method === "OPTIONS" ||
    HMAC_AUTHENTICATED_PIPELINE_PATHS.has(c.req.path)
  ) {
    return next();
  }

  const token = c.req.header("cf-access-jwt-assertion");
  if (!token) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Cloudflare Access required");
  }

  try {
    await jwtVerify(token, getJwks(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN), {
      issuer: env.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
      audience: env.CLOUDFLARE_ACCESS_AUD,
    });
  } catch {
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      "Invalid Cloudflare Access token",
    );
  }

  await next();
});

function getJwks(teamDomain: string): JWTVerifyGetKey {
  if (!jwks || jwksTeamDomain !== teamDomain) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    jwksTeamDomain = teamDomain;
  }
  return jwks;
}
