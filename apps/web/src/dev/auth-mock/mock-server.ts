/**
 * An in-browser stand-in for the auth API, for exercising every auth view
 * without a real account. It intercepts `fetch` calls to the Better Auth base
 * URL and answers them from state kept in localStorage. See README.md.
 */

export interface MockWorkspace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: string;
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockState {
  /** Who is signed in, if anyone. */
  user: MockUser | null;
  /** Accounts created through the sign-up form. */
  accounts: Record<string, { name: string; verified: boolean }>;
  workspaces: MockWorkspace[];
  activeWorkspaceId: string | null;
  /** What a first sign-in finds: no workspace (onboarding) or one. */
  workspacesOnSignIn: "none" | "one";
  /** Artificial network delay, to see pending and submitting states. */
  latencyMs: number;
}

const STORAGE_KEY = "mnemee:auth-mock:v1";

const DEFAULT_STATE: MockState = {
  user: null,
  accounts: {},
  workspaces: [],
  activeWorkspaceId: null,
  workspacesOnSignIn: "none",
  latencyMs: 400,
};

function load(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...(JSON.parse(raw) as MockState) };
  } catch {
    // Fall through to a clean state.
  }
  return { ...DEFAULT_STATE };
}

let state: MockState = load();
const listeners = new Set<() => void>();

function commit(next: MockState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is a convenience only.
  }
  for (const listener of listeners) listener();
}

export const mockStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  update(patch: Partial<MockState>) {
    commit({ ...state, ...patch });
  },
  /** Back to a clean, signed-out state (keeps the toolbar's own settings). */
  reset() {
    commit({
      ...DEFAULT_STATE,
      workspacesOnSignIn: state.workspacesOnSignIn,
      latencyMs: state.latencyMs,
    });
  },
  signOut() {
    commit({ ...state, user: null, activeWorkspaceId: null });
  },
};

const now = () => new Date().toISOString();
const id = () => Math.random().toString(36).slice(2, 10);

function makeUser(email: string, name?: string): MockUser {
  return {
    id: `user_${id()}`,
    name: name || email.split("@")[0] || email,
    email,
    emailVerified: true,
    image: null,
    createdAt: now(),
    updatedAt: now(),
  };
}

function signIn(email: string) {
  const known = state.accounts[email];
  const user = makeUser(email, known?.name);
  let { workspaces, activeWorkspaceId } = state;
  if (state.workspacesOnSignIn === "one" && workspaces.length === 0) {
    const workspace: MockWorkspace = {
      id: `org_${id()}`,
      name: "Studio",
      slug: "studio",
      logo: null,
      createdAt: now(),
    };
    workspaces = [workspace];
    activeWorkspaceId = workspace.id;
  }
  commit({ ...state, user, workspaces, activeWorkspaceId });
  return user;
}

function session() {
  if (!state.user) return null;
  return {
    session: {
      id: "session_mock",
      token: "mock-token",
      userId: state.user.id,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: now(),
      updatedAt: now(),
      ipAddress: null,
      userAgent: null,
      activeOrganizationId: state.activeWorkspaceId,
    },
    user: state.user,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fail(status: number, code: string, message: string) {
  return json({ code, message }, status);
}

type Body = Record<string, unknown>;

function route(path: string, method: string, body: Body): Response {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp : "";

  switch (`${method} ${path}`) {
    case "GET /get-session":
      return json(session());

    case "POST /sign-in/email": {
      if (email.includes("unverified")) {
        return fail(403, "EMAIL_NOT_VERIFIED", "Email not verified");
      }
      if (body.password === "wrong") {
        return fail(
          401,
          "INVALID_EMAIL_OR_PASSWORD",
          "Invalid email or password",
        );
      }
      const user = signIn(email);
      return json({ redirect: false, token: "mock-token", user });
    }

    case "POST /sign-up/email": {
      if (email.includes("taken")) {
        return fail(
          422,
          "USER_ALREADY_EXISTS",
          "User already exists. Use another email.",
        );
      }
      const name = typeof body.name === "string" ? body.name : "";
      commit({
        ...state,
        accounts: { ...state.accounts, [email]: { name, verified: false } },
      });
      return json({ token: null, user: makeUser(email, name) });
    }

    case "POST /email-otp/send-verification-otp":
    case "POST /email-otp/request-password-reset":
      return json({ success: true });

    case "POST /email-otp/verify-email": {
      if (otp === "000000") return fail(400, "INVALID_OTP", "Invalid OTP");
      const user = signIn(email);
      return json({ status: true, token: "mock-token", user });
    }

    case "POST /email-otp/check-verification-otp":
      if (otp === "000000") return fail(400, "INVALID_OTP", "Invalid OTP");
      return json({ success: true });

    case "POST /email-otp/reset-password":
      if (otp === "000000") return fail(400, "INVALID_OTP", "Invalid OTP");
      if (otp === "999999") return fail(400, "OTP_EXPIRED", "OTP expired");
      return json({ success: true });

    case "POST /sign-out":
      mockStore.signOut();
      return json({ success: true });

    case "GET /organization/list":
      if (!state.user) return fail(401, "UNAUTHORIZED", "Unauthorized");
      return json(state.workspaces);

    case "POST /organization/create": {
      if (!state.user) return fail(401, "UNAUTHORIZED", "Unauthorized");
      const workspace: MockWorkspace = {
        id: `org_${id()}`,
        name: String(body.name ?? "Workspace"),
        slug: String(body.slug ?? "workspace"),
        logo: null,
        createdAt: now(),
      };
      commit({
        ...state,
        workspaces: [...state.workspaces, workspace],
        activeWorkspaceId: workspace.id,
      });
      return json(workspace);
    }

    case "POST /organization/set-active": {
      const workspace = state.workspaces.find(
        (item) => item.id === body.organizationId,
      );
      if (!workspace) return fail(404, "NOT_FOUND", "Workspace not found");
      commit({ ...state, activeWorkspaceId: workspace.id });
      return json(workspace);
    }

    default:
      return fail(404, "NOT_MOCKED", `Not mocked: ${method} ${path}`);
  }
}

/** The app's API origin; the real one must never be reached in mock mode. */
const SERVER_URL = (
  import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

async function readBody(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const raw =
      typeof init?.body === "string"
        ? init.body
        : input instanceof Request
          ? await input.clone().text()
          : "";
    return raw ? (JSON.parse(raw) as Body) : {};
  } catch {
    return {};
  }
}

const realFetch = window.fetch.bind(window);

/** Answers auth API calls from the mock; anything else goes to the real fetch. */
export const mockFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (!url.startsWith(SERVER_URL)) return realFetch(input, init);

  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const { pathname } = new URL(url);
  const path = pathname.replace(/^\/api\/auth/, "") || "/";

  if (state.latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, state.latencyMs));
  }

  // Anything outside the auth API is refused instead of reaching a real server.
  if (!pathname.startsWith("/api/auth")) {
    return fail(404, "NOT_MOCKED", `Not mocked: ${method} ${pathname}`);
  }

  return route(path, method, await readBody(input, init));
};

/** Also covers fetches made outside the auth client, so none reach a real server. */
export function installMockFetch() {
  window.fetch = mockFetch;
}
