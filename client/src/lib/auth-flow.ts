import { redirect, type ParsedLocation } from "@tanstack/react-router";
import {
  authClient,
  type AuthSession,
  type Workspace,
} from "@/lib/auth-client";

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
    throw error;
  }

  return data;
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

  if (!session) {
    return null;
  }

  const workspaces = await getWorkspaces();
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
