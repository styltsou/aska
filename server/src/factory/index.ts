import { createFactory } from "hono/factory";

import type { AuthSession } from "@/lib/auth";

type ApiVariables = {
  requestId: string;
  authSession: AuthSession["session"];
  user: AuthSession["user"];
  userId: AuthSession["user"]["id"];
  activeOrganizationId: string | null;
};

export const factory = createFactory<{ Variables: ApiVariables }>();
