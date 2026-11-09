import { afterEach, describe, expect, it, vi } from "vitest";

import { streamNoteAi, takeServerSentEvents } from "./note-ai-stream";

describe("takeServerSentEvents", () => {
  it("parses complete events and keeps the partial tail", () => {
    const { events, rest } = takeServerSentEvents(
      'event: custom\ndata: {"type":"delta","text":"Hi"}\n\n' +
        'event: custom\ndata: {"type":"done"}\n\nevent: cus',
    );
    expect(events).toEqual([
      { event: "custom", data: { type: "delta", text: "Hi" } },
      { event: "custom", data: { type: "done" } },
    ]);
    expect(rest).toBe("event: cus");
  });

  it("handles CRLF line endings and skips malformed data", () => {
    const { events } = takeServerSentEvents(
      'event: error\r\ndata: {"message":"nope"}\r\n\r\ndata: {oops\n\n',
    );
    expect(events).toEqual([{ event: "error", data: { message: "nope" } }]);
  });
});

describe("streamNoteAi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports status steps before text and stops at done", async () => {
    const events = [
      { type: "status", text: "Searching this note…" },
      { type: "delta", text: "March " },
      { type: "delta", text: "3." },
      { type: "done" },
    ]
      .map((data) => `event: custom\ndata: ${JSON.stringify(data)}\n\n`)
      .join("");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(events, { status: 200 })),
    );
    const seen: string[] = [];
    await streamNoteAi(
      { prompt: "When?", note: "⟦cursor⟧" },
      {
        signal: new AbortController().signal,
        onStatus: (text) => seen.push(`status:${text}`),
        onDelta: (text) => seen.push(text),
      },
    );
    expect(seen).toEqual(["status:Searching this note…", "March ", "3."]);
  });
});
