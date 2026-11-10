import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiPost, getUserFacingApiErrorMessage } from "./api";

describe("getUserFacingApiErrorMessage", () => {
  it("does not expose raw validation payloads", () => {
    const rawMessage = '[{"origin":"string","code":"too_big","maximum":10000}]';
    expect(
      getUserFacingApiErrorMessage(
        new ApiError(400, rawMessage, "validation_error"),
        "Could not save note.",
      ),
    ).toBe("The provided information is invalid.");
  });

  it("uses the caller fallback for unknown errors", () => {
    expect(
      getUserFacingApiErrorMessage(new Error("private error"), "Try again."),
    ).toBe("Try again.");
  });
});

describe("inbox creation requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signals an open inbox without adding a CORS header", async () => {
    vi.stubGlobal("window", { location: { pathname: "/work/inbox" } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/api/v1/workspace/work/inbox/notes", { content: "hello" });

    expect(fetchMock.mock.calls[0]![0]).toContain(
      "/inbox/notes?inboxVisible=1",
    );
    const headers = fetchMock.mock.calls[0]![1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.has("X-Inbox-Visible")).toBe(false);
  });

  it("does not signal an inbox belonging to another workspace", async () => {
    vi.stubGlobal("window", { location: { pathname: "/other/inbox" } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/api/v1/workspace/work/inbox/notes", { content: "hello" });

    expect(fetchMock.mock.calls[0]![0]).not.toContain("inboxVisible");
  });
});
