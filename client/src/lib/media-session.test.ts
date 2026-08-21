import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiDelete, apiPost } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

type MockFunction = ReturnType<typeof vi.fn>;
const post = apiPost as unknown as MockFunction;
const deleteRequest = apiDelete as unknown as MockFunction;
const realDateNow = Date.now;

describe("media session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Date.now = () => new Date("2026-08-03T08:00:00.000Z").getTime();
    post.mockReset();
    deleteRequest.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    Date.now = realDateNow;
  });

  it("deduplicates issuance and reuses the session until its refresh window", async () => {
    post.mockResolvedValue({
      enabled: true,
      expiresAt: "2026-08-03T09:00:00.000Z",
    });
    const { ensureMediaSession } = await import("./media-session");

    await Promise.all([
      ensureMediaSession("workspace-a"),
      ensureMediaSession("workspace-a"),
    ]);
    await ensureMediaSession("workspace-a");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/api/v1/media/session/workspace-a");
  });

  it("clears viewer cookies and allows a fresh session after logout", async () => {
    post.mockResolvedValue({
      enabled: true,
      expiresAt: "2026-08-03T09:00:00.000Z",
    });
    deleteRequest.mockResolvedValue({ revoked: true });
    const { clearMediaSession, ensureMediaSession } =
      await import("./media-session");

    await ensureMediaSession("workspace-b");
    await clearMediaSession();
    await ensureMediaSession("workspace-b");

    expect(deleteRequest).toHaveBeenCalledWith("/api/v1/media/session");
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("keeps browser sessions independent for separate workspaces", async () => {
    post.mockResolvedValue({
      enabled: true,
      expiresAt: "2026-08-03T09:00:00.000Z",
    });
    const { ensureMediaSession } = await import("./media-session");

    await Promise.all([
      ensureMediaSession("workspace-c"),
      ensureMediaSession("workspace-d"),
    ]);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith("/api/v1/media/session/workspace-c");
    expect(post).toHaveBeenCalledWith("/api/v1/media/session/workspace-d");
  });
});
