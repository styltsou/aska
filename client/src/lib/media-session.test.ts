import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiPost: api.post,
  apiDelete: api.delete,
}));

describe("media session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T08:00:00.000Z"));
    vi.resetModules();
    api.post.mockReset();
    api.delete.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates issuance and reuses the session until its refresh window", async () => {
    api.post.mockResolvedValue({
      enabled: true,
      expiresAt: "2026-08-03T09:00:00.000Z",
    });
    const { ensureMediaSession } = await import("./media-session");

    await Promise.all([
      ensureMediaSession("workspace-a"),
      ensureMediaSession("workspace-a"),
    ]);
    await ensureMediaSession("workspace-a");

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/api/v1/media/session/workspace-a");
  });

  it("clears viewer cookies and allows a fresh session after logout", async () => {
    api.post.mockResolvedValue({
      enabled: true,
      expiresAt: "2026-08-03T09:00:00.000Z",
    });
    api.delete.mockResolvedValue({ revoked: true });
    const { clearMediaSession, ensureMediaSession } =
      await import("./media-session");

    await ensureMediaSession("workspace-a");
    await clearMediaSession();
    await ensureMediaSession("workspace-a");

    expect(api.delete).toHaveBeenCalledWith("/api/v1/media/session");
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it("keeps browser sessions independent for separate workspaces", async () => {
    api.post.mockResolvedValue({
      enabled: true,
      expiresAt: "2026-08-03T09:00:00.000Z",
    });
    const { ensureMediaSession } = await import("./media-session");

    await Promise.all([
      ensureMediaSession("workspace-a"),
      ensureMediaSession("workspace-b"),
    ]);

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenCalledWith("/api/v1/media/session/workspace-a");
    expect(api.post).toHaveBeenCalledWith("/api/v1/media/session/workspace-b");
  });
});
