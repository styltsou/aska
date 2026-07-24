import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { env } from "@/config";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";

const IMAGE_PIPELINE_CALLBACK_PATH = "/api/v1/internal/image-pipeline/callback";

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
  // authenticate this one callback with an HMAC secret and replay checks.
  if (
    c.req.method === "OPTIONS" ||
    c.req.path === IMAGE_PIPELINE_CALLBACK_PATH
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
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksTeamDomain = teamDomain;
  }
  return jwks;
}
