import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser } }));

function deferred() {
  let resolve!: (value: { error: { message: string } | null }) => void;
  const promise = new Promise<{ error: { message: string } | null }>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetModules();
  updateUser.mockReset();
});

describe("optimistic avatar selection", () => {
  it("releases the override only after the final save and matching session refresh", async () => {
    const request = deferred();
    updateUser.mockReturnValueOnce(request.promise);
    const { chooseAvatar, getOptimisticAvatar, reconcileAvatar } =
      await import("./optimistic-avatar");

    chooseAvatar("user", "gradient:aurora", "gradient:ember");
    reconcileAvatar("user", "gradient:aurora");
    expect(getOptimisticAvatar().avatar).toBe("gradient:aurora");
    request.resolve({ error: null });
    await vi.waitFor(() => expect(getOptimisticAvatar().saving).toBe(false));

    reconcileAvatar("user", "gradient:ember");
    expect(getOptimisticAvatar().avatar).toBe("gradient:aurora");
    reconcileAvatar("user", "gradient:aurora");
    expect(getOptimisticAvatar().avatar).toBeNull();
    // A later change from another tab now comes from the live session directly.
    reconcileAvatar("user", "gradient:dusk");
    expect(getOptimisticAvatar().avatar).toBeNull();

    // Rollback for a subsequent choice uses that fresh session, not an old save.
    updateUser.mockResolvedValueOnce({ error: { message: "Save failed" } });
    chooseAvatar("user", "gradient:lagoon", "gradient:dusk");
    await vi.waitFor(() => expect(getOptimisticAvatar().saving).toBe(false));
    expect(getOptimisticAvatar().avatar).toBe("gradient:dusk");
  });

  it("shows the latest choice immediately and coalesces rapid writes", async () => {
    const first = deferred();
    const last = deferred();
    updateUser
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(last.promise);
    const { chooseAvatar, getOptimisticAvatar } =
      await import("./optimistic-avatar");

    chooseAvatar("user", "gradient:aurora", "gradient:ember");
    chooseAvatar("user", "gradient:dusk", "gradient:ember");
    chooseAvatar("user", "gradient:lagoon", "gradient:ember");
    expect(getOptimisticAvatar().avatar).toBe("gradient:lagoon");
    expect(updateUser).toHaveBeenCalledTimes(1);

    first.resolve({ error: null });
    await first.promise;
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledTimes(2));
    expect(updateUser).toHaveBeenLastCalledWith({ avatar: "gradient:lagoon" });
    last.resolve({ error: null });
    await last.promise;
  });

  it("restores the last saved choice if the final write fails", async () => {
    const first = deferred();
    const last = deferred();
    updateUser
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(last.promise);
    const { chooseAvatar, getOptimisticAvatar } =
      await import("./optimistic-avatar");

    chooseAvatar("user", "gradient:aurora", "gradient:ember");
    chooseAvatar("user", "gradient:dusk", "gradient:ember");
    first.resolve({ error: null });
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledTimes(2));
    last.resolve({ error: { message: "Save failed" } });
    await vi.waitFor(() =>
      expect(getOptimisticAvatar().error).toBe("Save failed"),
    );
    expect(getOptimisticAvatar().avatar).toBe("gradient:aurora");
  });
});
