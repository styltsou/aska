import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "@/config/env";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

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
        // Keep the default (requireLocalEmailVerified: true). Linking Google
        // into an unverified email+password account would let whoever
        // pre-registered that address keep their password after the real
        // owner signs in with Google. The web app tells such users to verify.
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // No session until the email is verified. Signing in unverified is
      // rejected with EMAIL_NOT_VERIFIED and re-sends the verification email.
      requireEmailVerification: true,
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
