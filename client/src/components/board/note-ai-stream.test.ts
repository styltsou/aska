import { describe, expect, it } from "vitest";

import { takeServerSentEvents } from "./note-ai-stream";

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
