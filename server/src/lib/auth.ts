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
    appName: "Aska",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL, ...env.CORS_ORIGINS],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: "none",
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
