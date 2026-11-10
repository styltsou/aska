import { apiDelete, apiPost } from "@/lib/api";

type MediaSessionResponse = {
  enabled: boolean;
  expiresAt: string | null;
};

const REFRESH_SKEW_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;

type WorkspaceMediaSession = {
  validUntil: number;
  retryAfter: number;
  issuePromise: Promise<void> | null;
};

const sessions = new Map<string, WorkspaceMediaSession>();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Ensures CloudFront viewer cookies exist before media-backed routes render.
 * Calls are deduplicated and a successful session is renewed shortly before
 * its policy expires, so route navigation does not repeatedly sign cookies.
 */
export async function ensureMediaSession(workspaceSlug: string): Promise<void> {
  const session = sessions.get(workspaceSlug) ?? {
    validUntil: 0,
    retryAfter: 0,
    issuePromise: null,
  };
  sessions.set(workspaceSlug, session);
  const now = Date.now();
  if (now < session.retryAfter) {
    scheduleRefresh(workspaceSlug, session.retryAfter - now);
    return;
  }
  if (now < session.validUntil - REFRESH_SKEW_MS) return;
  if (session.issuePromise) return session.issuePromise;

  session.issuePromise = issueMediaSession(workspaceSlug, session).finally(
    () => {
      session.issuePromise = null;
    },
  );
  return session.issuePromise;
}

export async function clearMediaSession(): Promise<void> {
  // Let an in-flight issuance finish before deleting the cookies so logout
  // cannot race with a late Set-Cookie response that restores media access.
  await Promise.all(
    [...sessions.values()].map((session) =>
      session.issuePromise?.catch(() => undefined),
    ),
  );
  resetMediaSessionState();
  await apiDelete<{ revoked: true }>("/api/v1/media/session");
}

async function issueMediaSession(
  workspaceSlug: string,
  session: WorkspaceMediaSession,
): Promise<void> {
  try {
    const response = await apiPost<MediaSessionResponse>(
      `/api/v1/media/session/${encodeURIComponent(workspaceSlug)}`,
    );

    session.retryAfter = 0;
    if (!response.enabled) {
      session.validUntil = Number.POSITIVE_INFINITY;
      clearRefreshTimer();
      return;
    }

    const expiresAt = response.expiresAt
      ? Date.parse(response.expiresAt)
      : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error("The media session returned an invalid expiration time.");
    }

    session.validUntil = expiresAt;
    scheduleRefresh(
      workspaceSlug,
      Math.max(1_000, expiresAt - Date.now() - REFRESH_SKEW_MS),
    );
  } catch (error) {
    session.validUntil = 0;
    session.retryAfter = Date.now() + RETRY_DELAY_MS;
    scheduleRefresh(workspaceSlug, RETRY_DELAY_MS);
    throw error;
  }
}

function scheduleRefresh(workspaceSlug: string, delayMs: number): void {
  clearRefreshTimer();
  refreshTimer = setTimeout(() => {
    void ensureMediaSession(workspaceSlug).catch((error) => {
      console.error("Unable to refresh the media session", error);
    });
  }, delayMs);
}

function clearRefreshTimer(): void {
  if (refreshTimer !== undefined) clearTimeout(refreshTimer);
  refreshTimer = undefined;
}

function resetMediaSessionState(): void {
  sessions.clear();
  clearRefreshTimer();
}
