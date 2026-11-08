import { FakeListChatModel } from "@langchain/core/utils/testing";
import { describe, expect, it } from "vitest";

import { createNoteEditGraph } from "@/ai/note-graph";
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

describe("createNoteModel", () => {
  it("is unavailable without its key", () => {
    expect(createNoteModel({})).toBeNull();
  });
});
