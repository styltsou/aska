import { FakeListChatModel } from "@langchain/core/utils/testing";
import { describe, expect, it } from "vitest";

import { createNoteEditGraph, userMessage } from "@/ai/note-graph";
import { createNoteModel } from "@/ai/note-model";

describe("createNoteEditGraph", () => {
  it("streams any chat model's output in pieces, without repeating it", async () => {
    const graph = createNoteEditGraph(
      new FakeListChatModel({ responses: ["Scratchpads keep capture fast."] }),
    );
    const pieces: string[] = [];
    for await (const [chunk] of await graph.stream(
      { prompt: "Why scratchpads?", note: "⟦cursor⟧" },
      { streamMode: "messages" },
    )) {
      if (typeof chunk.content === "string" && chunk.content) {
        pieces.push(chunk.content);
      }
    }
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join("")).toBe("Scratchpads keep capture fast.");
  });
});

describe("userMessage", () => {
  it("gives a follow-up the instructions behind its draft", () => {
    const message = userMessage({
      prompt: "Now in Spanish",
      note: "⟦cursor⟧",
      draft: "Scratchpads help.",
      earlierPrompts: ["Why scratchpads help", "Shorter"],
    });
    expect(message).toContain("1. Why scratchpads help\n2. Shorter");
    expect(message.indexOf("Shorter")).toBeLessThan(
      message.indexOf("Now in Spanish"),
    );
  });

  it("leaves first requests as a plain instruction", () => {
    const message = userMessage({ prompt: "Hi", note: "", draft: "" });
    expect(message).toContain("Instruction:\nHi");
    expect(message).not.toContain("oldest first");
  });
});

describe("createNoteModel", () => {
  it("is unavailable without its key", () => {
    expect(createNoteModel({})).toBeNull();
  });
});
