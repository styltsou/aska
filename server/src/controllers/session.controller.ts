import { deleteCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";

import { env } from "@/config";
import { container } from "@/container";
import { db } from "@/db";
import { member } from "@/db/schema";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import { factory } from "@/factory";
import {
  CLOUDFRONT_SIGNED_COOKIE_NAMES,
  createCloudFrontSignedCookies,
} from "@/lib/cloudfront-signed-cookies";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import type { ICollectionService } from "@/services/collection.service";

const LEGACY_MEDIA_COOKIE_PATHS = ["/assets/", "/"] as const;
const collectionService: ICollectionService = container.collectionService;

function mediaCookiePath(workspaceId: string): string {
  return `/${workspaceId}/`;
}

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

export const issueMediaSession = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  async (c) => {
    c.header("Cache-Control", "no-store");

    const { workspaceSlug } = c.req.valid("param");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );

    if (!hasCloudFrontMediaConfig()) {
      return c.json(success({ enabled: false, expiresAt: null }));
    }

    const now = Date.now();
    const cookies = createCloudFrontSignedCookies(
      {
        mediaBaseUrl: env.MEDIA_BASE_URL!,
        workspaceId: workspace.id,
        publicKeyId: env.CLOUDFRONT_KEY_PAIR_ID!,
        privateKeyBase64: env.CLOUDFRONT_PRIVATE_KEY_BASE64!,
        expiresInSeconds: env.CLOUDFRONT_SIGNED_COOKIE_EXPIRES_SECONDS,
      },
      now,
    );

    for (const cookie of cookies) {
      // Remove generic cookies issued before workspace scoping. Cookies with
      // the same name but different paths otherwise coexist by design.
      for (const path of LEGACY_MEDIA_COOKIE_PATHS) {
        deleteCookie(c, cookie.name, {
          domain: env.CLOUDFRONT_COOKIE_DOMAIN!,
          path,
          secure: true,
        });
      }
      setCookie(c, cookie.name, cookie.value, {
        domain: env.CLOUDFRONT_COOKIE_DOMAIN!,
        httpOnly: true,
        path: mediaCookiePath(workspace.id),
        secure: true,
        sameSite: "lax",
      });
    }

    const expiresAt = new Date(
      (Math.floor(now / 1000) + env.CLOUDFRONT_SIGNED_COOKIE_EXPIRES_SECONDS) *
        1000,
    );
    return c.json(
      success({ enabled: true, expiresAt: expiresAt.toISOString() }),
    );
  },
);

export const revokeMediaSession = factory.createHandlers(
  authMiddleware,
  async (c) => {
    c.header("Cache-Control", "no-store");

    if (env.CLOUDFRONT_COOKIE_DOMAIN) {
      const workspaces = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, c.get("userId")));
      for (const name of CLOUDFRONT_SIGNED_COOKIE_NAMES) {
        for (const path of [
          ...LEGACY_MEDIA_COOKIE_PATHS,
          ...workspaces.map((workspace) =>
            mediaCookiePath(workspace.organizationId),
          ),
        ]) {
          deleteCookie(c, name, {
            domain: env.CLOUDFRONT_COOKIE_DOMAIN,
            path,
            secure: true,
          });
        }
      }
    }

    return c.json(success({ revoked: true }));
  },
);

function hasCloudFrontMediaConfig(): boolean {
  return Boolean(
    env.MEDIA_BASE_URL &&
    env.CLOUDFRONT_KEY_PAIR_ID &&
    env.CLOUDFRONT_PRIVATE_KEY_BASE64 &&
    env.CLOUDFRONT_COOKIE_DOMAIN,
  );
}
