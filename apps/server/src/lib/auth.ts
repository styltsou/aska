import { APIError, betterAuth } from "better-auth";
import { emailOTP, organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";

import { env } from "@/config/env";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { buildOtpEmail, OTP_EXPIRES_IN_SECONDS } from "@/emails/otp-emails";
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

/** `gradient:<id>` today; `upload:<key>` joins it when avatar uploads ship. */
const AVATAR_PATTERN = /^gradient:[a-z0-9-]{1,32}$/;

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
              // Keeps `user.image` current. It never touches `user.avatar`,
              // which holds the user's own choice and always wins.
              overrideUserInfoOnSignIn: true,
            },
          }
        : {},
    user: {
      additionalFields: {
        avatar: { type: "string", required: false, input: true },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        updateUserInfoOnLink: true,
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
        // The email OTP plugin adds its own 3 per 60s limits on its routes.
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // No session until the email is verified. Signing in unverified is
      // rejected with EMAIL_NOT_VERIFIED and re-sends the verification email.
      requireEmailVerification: true,
      // A reset means the old password may be compromised: sign out everywhere.
      // Resets go through the email OTP plugin; there is no link-based reset
      // (`sendResetPassword` is deliberately not configured).
      revokeSessionsOnPasswordReset: true,
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
      user: {
        update: {
          before: async (data) => {
            if (data.avatar === undefined) return { data };
            // "" clears the choice. Anything else must be a known source kind.
            const avatar = data.avatar === "" ? null : data.avatar;
            if (avatar !== null && !AVATAR_PATTERN.test(String(avatar))) {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid avatar.",
              });
            }
            return { data: { ...data, avatar } };
          },
        },
      },
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
      // The emailOTP plugin (overrideDefaultEmailVerification) supplies the
      // sender, so sign-up and unverified sign-in mail a code, not a link.
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        otpLength: 6,
        expiresIn: OTP_EXPIRES_IN_SECONDS,
        // Wrong guesses allowed per code before it is invalidated.
        allowedAttempts: 3,
        storeOTP: "hashed",
        // We only use OTPs for verification and reset. Never let the plugin
        // create accounts, and never deliver sign-in or change-email codes, so
        // those routes cannot be used as a passwordless login.
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          const message = buildOtpEmail(type, otp);
          if (message) await sendEmail({ to: email, ...message });
        },
      }),
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
