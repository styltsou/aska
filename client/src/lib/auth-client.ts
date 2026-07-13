import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const DEFAULT_SERVER_URL = "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL ?? DEFAULT_SERVER_URL,
  plugins: [organizationClient()],
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
