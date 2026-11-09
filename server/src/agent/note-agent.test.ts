import { describe, expect, it } from "vitest";

import { EVAL_CASES } from "@/agent/eval/cases";
import {
  ScriptedChatModel,
  type ScriptedStep,
} from "@/agent/eval/scripted-model";
import { runNoteAgent, type NoteAgentInput } from "@/agent/note-agent";
import { noteOverview, readSection, searchText } from "@/agent/note-context";

const longNote = EVAL_CASES.find(
  (testCase) => testCase.id === "far-in-note",
)!.note;

async function run(input: NoteAgentInput, steps: ScriptedStep[]) {
  const model = new ScriptedChatModel(steps);
  const events = [];
  for await (const event of runNoteAgent(input, model)) events.push(event);
  const text = events
    .flatMap((event) => (event.type === "text" ? [event.text] : []))
    .join("");
  return { model, events, text };
}

describe("note context", () => {
  it("includes a short note whole and outlines a long one", () => {
    expect(noteOverview("# Hi\n\n⟦cursor⟧", "⟦cursor⟧").complete).toBe(true);
    const overview = noteOverview(longNote, "⟦cursor⟧");
    expect(overview.complete).toBe(false);
    expect(overview.text).toContain("<note-outline>");
    expect(overview.text).toContain("- Week 1 (lines");
    expect(overview.text).not.toContain("March 3");
  });

  it("reads a section by heading and searches lines", () => {
    const text = "# A\n\none\n\n## B\n\ntwo\n\n# C\n\nthree";
    expect(readSection(text, { heading: "b" })).toBe(
      "5| ## B\n6| \n7| two\n8| ",
    );
    expect(searchText(text, "tw")).toBe("1 matching line:\n7| two");
    expect(searchText(text, "[unclosed")).toContain("No lines match");
  });
});

describe("runNoteAgent", () => {
  it("looks up what the overview doesn't show, then answers", async () => {
    const { model, events, text } = await run(
      { prompt: "When do we launch?", note: longNote },
      [
        {
          tool: "search_note",
          args: { pattern: "launch date" },
          preamble: "Let me check. ",
        },
        { text: "The public launch is on March 3." },
      ],
    );
    expect(events.filter((event) => event.type !== "text")).toEqual([
      { type: "status", text: "Searching this note…" },
      { type: "tool", name: "search_note", args: { pattern: "launch date" } },
    ]);
    // The preamble before the tool call never reaches the note.
    expect(text).toBe("The public launch is on March 3.");
    expect(String(model.calls[1]!.at(-1)!.content)).toContain(
      "3| Decision from the kickoff: the public launch date is March 3",
    );
  });

  it("takes the fast path when everything is in view", async () => {
    const { model, events } = await run(
      { prompt: "A tagline", note: "# Scratchpad\n\n⟦cursor⟧" },
      [{ text: "Catch every loose thought." }],
    );
    expect(events.every((event) => event.type === "text")).toBe(true);
    expect(model.calls).toHaveLength(1);
    expect(String(model.calls[0]![0]!.content)).not.toContain("tools");
  });

  it("never attaches tools to a mechanical edit", async () => {
    const { model } = await run(
      {
        prompt: "Fix grammar",
        note: longNote,
        task: "mechanical",
        passage: "This are bad.",
      },
      [{ text: "This is bad." }],
    );
    expect(String(model.calls[0]![0]!.content)).toContain("mechanical edit");
    expect(String(model.calls[0]![0]!.content)).not.toContain("look it up");
  });

  it("makes the model answer after the round limit", async () => {
    const { model, events, text } = await run(
      { prompt: "Summarize", note: longNote },
      [
        ...Array.from({ length: 4 }, () => ({
          tool: "search_note",
          args: { pattern: "week" },
        })),
        { text: "Done." },
      ],
    );
    expect(events.filter((event) => event.type === "tool")).toHaveLength(4);
    expect(text).toBe("Done.");
    expect(String(model.calls.at(-1)!.at(-1)!.content)).toContain("Answer now");
  });

  it("shows large references as cards with their own tools", async () => {
    const big = EVAL_CASES.find(
      (testCase) => testCase.id === "deep-in-reference",
    )!;
    const { model, events, text } = await run(
      {
        prompt: big.instruction,
        note: big.note,
        references: big.references!.map((reference) => ({
          kind: "note" as const,
          title: reference.title,
          text: reference.markdown,
        })),
      },
      [
        {
          tool: "search_reference",
          args: { reference: "R1", pattern: "accent" },
        },
        { text: "Teal." },
      ],
    );
    expect(String(model.calls[0]![1]!.content)).toContain(
      '<reference-card kind="note" id="R1" title="Design review"',
    );
    expect(events[0]).toEqual({
      type: "status",
      text: "Searching Design review…",
    });
    expect(String(model.calls[1]!.at(-1)!.content)).toContain("teal (#0f766e)");
    expect(text).toBe("Teal.");
  });
});
