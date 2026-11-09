import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { CURSOR, type EvalCase } from "@/ai/eval/cases";
import { runNoteAgent } from "@/ai/note-agent";
import { createNoteEditGraph } from "@/ai/note-graph";

export type EvalEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string };

/** A way of answering a case; future pipelines (the agent loop) plug in here. */
export type EvalPipeline = (
  testCase: EvalCase,
  model: BaseChatModel,
) => AsyncIterable<EvalEvent>;

// Mirror the client's limits (note-ai-prompt.tsx, note-ai-mentions.tsx), so the
// baseline sees exactly what production sends.
const NOTE_CONTEXT_LIMIT = 38_000;
const REFERENCED_NOTE_LIMIT = 12_000;

function trimAroundCursor(note: string) {
  if (note.length <= NOTE_CONTEXT_LIMIT) return note;
  const cursor = Math.max(0, note.indexOf(CURSOR));
  const start = Math.max(
    0,
    Math.min(
      cursor - NOTE_CONTEXT_LIMIT * 0.7,
      note.length - NOTE_CONTEXT_LIMIT,
    ),
  );
  return note.slice(Math.floor(start), Math.floor(start) + NOTE_CONTEXT_LIMIT);
}

function messageText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" && part !== null && part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

/** Today's production pipeline: one model call over trimmed context. */
export const baselinePipeline: EvalPipeline = async function* (
  testCase,
  model,
) {
  const graph = createNoteEditGraph(model);
  for await (const [chunk] of await graph.stream(
    {
      prompt: testCase.instruction,
      note: trimAroundCursor(testCase.note),
      ...(testCase.passage ? { passage: testCase.passage } : {}),
      ...(testCase.references
        ? {
            referencedNotes: testCase.references.map((reference) => ({
              title: reference.title,
              markdown: reference.markdown.slice(0, REFERENCED_NOTE_LIMIT),
            })),
          }
        : {}),
    },
    { streamMode: "messages" },
  )) {
    const text = messageText(chunk.content);
    if (text) yield { type: "text", text };
  }
};

/** The agent: overview plus tools, whole note and references available. */
export const agentPipeline: EvalPipeline = async function* (testCase, model) {
  for await (const event of runNoteAgent(
    {
      prompt: testCase.instruction,
      note: testCase.note,
      task: testCase.task,
      ...(testCase.passage ? { passage: testCase.passage } : {}),
      ...(testCase.references ? { referencedNotes: testCase.references } : {}),
    },
    model,
  )) {
    if (event.type === "text") yield { type: "text", text: event.text };
    else if (event.type === "tool") yield { type: "tool", name: event.name };
  }
};

export const PIPELINES: Record<string, EvalPipeline> = {
  agent: agentPipeline,
  baseline: baselinePipeline,
};

/** Pipelines that can call tools, so fake runs script lookups for them. */
export const TOOL_PIPELINES = new Set(["agent"]);
