import { redirect, type ParsedLocation } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import {
  authClient,
  type AuthSession,
  type Workspace,
} from "@/lib/auth-client";
import { ensureMediaSession } from "@/lib/media-session";

export type AuthState = {
  session: AuthSession;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
};

const AUTH_STATE_TTL_MS = 30_000;

let authStateCache: {
  value: AuthState | null;
  expiresAt: number;
} | null = null;
let authStatePromise: Promise<AuthState | null> | null = null;

function toLoginRedirect(location: ParsedLocation): never {
  throw redirect({
    to: "/login",
    search: {
      redirect: location.href,
    },
  });
}

async function getSession() {
  const { data, error } = await authClient.getSession();

  if (error) {
    // A refresh can race with session cleanup on the server. This is still a
    // signed-out state, not an application failure that should reach the
    // router error boundary.
    if (isUnauthorizedError(error)) {
      return null;
    }

    throw error;
  }

  return data;
}

function isUnauthorizedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 401
  );
}

export async function getWorkspaces() {
  const { data, error } = await authClient.$fetch<Workspace[]>(
    "/organization/list",
    {
      method: "GET",
    },
  );

  if (error) {
    throw error;
  }

  return (data ?? []) as Workspace[];
}

export function clearAuthStateCache() {
  authStateCache = null;
  authStatePromise = null;
}

export async function setActiveWorkspace(workspace: Workspace) {
  const { error } = await authClient.organization.setActive({
    organizationId: workspace.id,
  });

  if (error) {
    throw error;
  }

  if (authStateCache?.value) {
    authStateCache = {
      value: {
        ...authStateCache.value,
        activeWorkspace: workspace,
      },
      expiresAt: Date.now() + AUTH_STATE_TTL_MS,
    };
  }
}

export async function getAuthState() {
  const now = Date.now();
  if (authStateCache && authStateCache.expiresAt > now) {
    return authStateCache.value;
  }

  if (authStatePromise) {
    return authStatePromise;
  }

  authStatePromise = readAuthState()
    .then((state) => {
      authStateCache = {
        value: state,
        expiresAt: Date.now() + AUTH_STATE_TTL_MS,
      };
      return state;
    })
    .finally(() => {
      authStatePromise = null;
    });

  return authStatePromise;
}

async function readAuthState() {
  const session = await getSession();

  // A session may disappear between the browser sending its cookie and the
  // server reading it (for example after expiration, logout in another tab,
  // or a concurrent session cleanup). Treat an incomplete response exactly
  // like a signed-out state instead of allowing consumers to dereference it.
  if (!session?.session || !session.user) {
    Sentry.setUser(null);
    return null;
  }

  Sentry.setUser({ id: session.user.id });

  let workspaces: Workspace[];
  try {
    workspaces = await getWorkspaces();
  } catch (error) {
    // The session can be revoked after getSession succeeds but before this
    // follow-up request. Redirecting to sign-in is the correct recovery.
    if (isUnauthorizedError(error)) {
      return null;
    }

    throw error;
  }
  const activeWorkspace =
    workspaces.find(
      (workspace) => workspace.id === session.session.activeOrganizationId,
    ) ?? null;

  return {
    session,
    workspaces,
    activeWorkspace,
  } satisfies AuthState;
}

export async function getSignedInDestination() {
  const state = await getAuthState();

  if (!state) {
    return { to: "/login" as const };
  }

  if (state.workspaces.length === 0) {
    return { to: "/onboarding" as const };
  }

  const workspace = state.activeWorkspace ?? state.workspaces[0];

  if (!state.activeWorkspace) {
    await setActiveWorkspace(workspace);
  }

  return {
    to: "/$workspaceSlug" as const,
    params: { workspaceSlug: workspace.slug },
  };
}

export async function requireAuth(location: ParsedLocation) {
  const state = await getAuthState();

  if (!state) {
    toLoginRedirect(location);
  }

  if (!state) {
    throw new Error("Authentication redirect did not complete.");
  }

  return state;
}

export async function requireWorkspace(
  location: ParsedLocation,
  workspaceSlug: string,
) {
  const state = await requireAuth(location);

  if (state.workspaces.length === 0) {
    throw redirect({ to: "/onboarding" });
  }

  const requestedWorkspace = state.workspaces.find(
    (workspace) => workspace.slug === workspaceSlug,
  );

  if (!requestedWorkspace) {
    const fallbackWorkspace = state.activeWorkspace ?? state.workspaces[0];

    if (!state.activeWorkspace) {
      await setActiveWorkspace(fallbackWorkspace);
    }

    throw redirect({
      to: "/$workspaceSlug",
      params: { workspaceSlug: fallbackWorkspace.slug },
      replace: true,
    });
  }

  if (requestedWorkspace.id !== state.activeWorkspace?.id) {
    await setActiveWorkspace(requestedWorkspace);
  }

  // Establish CloudFront access before image-backed child routes render.
  // Media delivery is ancillary, so a signing outage must not block notes or
  // the rest of the authenticated workspace UI.
  await ensureMediaSession(requestedWorkspace.slug).catch((error) => {
    console.error("Unable to establish the media session", error);
  });

  return {
    ...state,
    activeWorkspace: requestedWorkspace,
  } satisfies AuthState;
}

export async function redirectIfSignedIn() {
  const destination = await getSignedInDestination();

  if (destination.to !== "/login") {
    throw redirect(destination);
  }
}
