import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";

import { AUTH_MOCK_ENABLED, mockFetch } from "@/dev/auth-mock";

const DEFAULT_SERVER_URL = "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL ?? DEFAULT_SERVER_URL,
  // Dev only: `bun run dev:auth-mock` answers auth calls in the browser.
  fetchOptions: AUTH_MOCK_ENABLED ? { customFetchImpl: mockFetch } : undefined,
  plugins: [
    organizationClient(),
    emailOTPClient(),
    // Mirrors `user.additionalFields` in the server's auth config.
    inferAdditionalFields({
      user: { avatar: { type: "string", required: false } },
    }),
  ],
  sessionOptions: {
    // Route guards own session refreshes. Avoid network requests just because
    // a user switches back to this browser tab.
    refetchOnWindowFocus: false,
  },
});

export const { signIn, signOut, signUp, useSession } = authClient;

export type AuthSession = typeof authClient.$Infer.Session;
export type AuthUser = AuthSession["user"];
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};
