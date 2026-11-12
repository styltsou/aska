import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";

import { env } from "@/config/env";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

/**
 * Pre-hijacking defence (Microsoft, "Pre-hijacked accounts", and OWASP
 * guidance). Someone can register a victim's email with a password they
 * control before the victim ever signs up. When a federated login whose email
 * the identity provider has verified is linked into a local account that was
 * never verified, the provider has just proven who really owns the address, so
 * the unverified credentials and sessions must not survive the link.
 */
async function discardUnverifiedLocalCredentials(userId: string) {
  const [existing] = await db
    .select({ emailVerified: schema.user.emailVerified })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  if (!existing || existing.emailVerified) return;

  await db
    .delete(schema.account)
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "credential"),
      ),
    );
  await db.delete(schema.session).where(eq(schema.session.userId, userId));
}

let _auth: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  return betterAuth({
    appName: "Mnemee",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL, ...env.CORS_ORIGINS],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    account: {
      accountLinking: {
        enabled: true,
        // Linking requires the provider to report a verified email (Google
        // does). If the local account was never verified, the databaseHooks
        // below wipe its password and sessions, so a pre-registered attacker
        // password cannot survive the link.
        requireLocalEmailVerified: false,
      },
    },
    rateLimit: {
      // Lambda instances don't share memory, so the default in-memory counters
      // would not actually limit anything. Keep them in Postgres.
      storage: "database",
      customRules: {
        // Endpoints that send email: keep them from being used to spam an inbox.
        "/send-verification-email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // No session until the email is verified. Signing in unverified is
      // rejected with EMAIL_NOT_VERIFIED and re-sends the verification email.
      requireEmailVerification: true,
      // A reset means the old password may be compromised: sign out everywhere.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your password",
          text: `Click the link to reset your password: ${url}

If you did not request this, you can ignore this email.`,
        });
      },
    },
    advanced: {
      useSecureCookies: true,
      // This is enabled only by the stable cloud stage. Keep the hybrid stage
      // unchanged, while allowing Chrome to retain a local-Vite cloud session.
      ...(env.CROSS_SITE_AUTH_COOKIES
        ? {
            crossSubDomainCookies: {
              enabled: true,
              // `configureEnv` requires this whenever this branch is enabled.
              domain: env.AUTH_COOKIE_DOMAIN!,
            },
            defaultCookieAttributes: {
              // Every authenticated API route lives below /api. This keeps
              // the shared cookie away from sibling static/media paths.
              path: "/api/",
              sameSite: "none" as const,
              secure: true,
              partitioned: true,
            },
          }
        : {}),
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => {
            if (account.providerId !== "credential") {
              await discardUnverifiedLocalCredentials(account.userId);
            }
          },
        },
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your email address",
          text: `Click the link to verify your email: ${url}`,
        });
      },
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
      }),
      apiKey(),
    ],
  });
}

export const auth = new Proxy<ReturnType<typeof createAuth>>(
  {} as ReturnType<typeof createAuth>,
  {
    get(_, prop) {
      if (!_auth) _auth = createAuth();
      return _auth[prop as keyof ReturnType<typeof createAuth>];
    },
  },
);

export type AuthSession = typeof auth.$Infer.Session;
