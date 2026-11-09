import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

import {
  noteOverview,
  readSection,
  referenceOverview,
  searchText,
  type ContextDocument,
} from "@/ai/note-context";
import {
  CURSOR_MARKER,
  systemPrompt,
  userPrompt,
  type NoteAiTask,
} from "@/ai/note-prompts";

/**
 * The note AI as a small agent: the model gets an overview of the note and of
 * mentioned notes, and when that isn't everything, tools to read and search
 * the rest. It loops (model → tools → model) until the model writes its
 * answer, which is the only text that reaches the note. Requests that can't
 * need a lookup take a fast path: no tools, one streaming call.
 *
 * See docs/proposals/ai-agentic-context.md.
 */

export type NoteAgentInput = {
  prompt: string;
  /** The whole note, with the cursor marker where the result goes. */
  note: string;
  task?: NoteAiTask | undefined;
  passage?: string | undefined;
  draft?: string | undefined;
  earlierPrompts?: string[] | undefined;
  referencedNotes?: Array<{ title: string; markdown: string }> | undefined;
};

export type NoteAgentEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | { type: "tool"; name: string; args: Record<string, unknown> };

/** Rounds of tool calls before the model must answer with what it has. */
const MAX_TOOL_ROUNDS = 4;
/**
 * Text held back at the start of a round that may still turn into a tool
 * call, so a preamble before a tool call never reaches the note.
 */
const HOLD_BACK_CHARS = 40;

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

const sectionArgs = {
  heading: z
    .string()
    .optional()
    .describe("Read the section under the first heading containing this text."),
  from_line: z.number().int().optional().describe("First line to read."),
  to_line: z.number().int().optional().describe("Last line to read."),
};

function buildTools(
  note: string,
  noteComplete: boolean,
  references: Array<ContextDocument & { complete: boolean }>,
) {
  const tools: StructuredToolInterface[] = [];
  const statuses = new Map<string, (args: Record<string, unknown>) => string>();

  if (!noteComplete) {
    tools.push(
      tool(
        ({ heading, from_line, to_line }) =>
          readSection(note, { heading, fromLine: from_line, toLine: to_line }),
        {
          name: "read_note_section",
          description:
            "Read part of the current note: a section by heading, or a line range. Lines come numbered.",
          schema: z.object(sectionArgs),
        },
      ),
      tool(({ pattern }) => searchText(note, pattern), {
        name: "search_note",
        description:
          "Find lines in the current note matching a pattern (case-insensitive; plain text or a regular expression). Returns numbered lines.",
        schema: z.object({ pattern: z.string().describe("What to look for.") }),
      }),
    );
    statuses.set("read_note_section", (args) =>
      typeof args.heading === "string"
        ? `Reading “${args.heading}”…`
        : "Reading the note…",
    );
    statuses.set("search_note", () => "Searching this note…");
  }

  const large = references.filter((reference) => !reference.complete);
  if (large.length) {
    const find = (id: unknown) =>
      references.find((reference) => reference.id === id);
    const referenceId = z
      .enum(large.map((reference) => reference.id) as [string, ...string[]])
      .describe("The id of a reference card.");
    tools.push(
      tool(
        ({ reference, heading, from_line, to_line }) => {
          const document = find(reference);
          return document
            ? readSection(document.text, {
                heading,
                fromLine: from_line,
                toLine: to_line,
              })
            : `No reference "${reference}".`;
        },
        {
          name: "read_reference",
          description:
            "Read part of a referenced note shown as a card: a section by heading, or a line range. Lines come numbered.",
          schema: z.object({ reference: referenceId, ...sectionArgs }),
        },
      ),
      tool(
        ({ reference, pattern }) => {
          const document = find(reference);
          return document
            ? searchText(document.text, pattern)
            : `No reference "${reference}".`;
        },
        {
          name: "search_reference",
          description:
            "Find lines in a referenced note shown as a card matching a pattern (case-insensitive; plain text or a regular expression).",
          schema: z.object({
            reference: referenceId,
            pattern: z.string().describe("What to look for."),
          }),
        },
      ),
    );
    statuses.set(
      "read_reference",
      (args) => `Reading ${find(args.reference)?.title ?? "a reference"}…`,
    );
    statuses.set(
      "search_reference",
      (args) => `Searching ${find(args.reference)?.title ?? "a reference"}…`,
    );
  }
  return { tools, statuses };
}

export async function* runNoteAgent(
  input: NoteAgentInput,
  model: BaseChatModel,
  { signal }: { signal?: AbortSignal } = {},
): AsyncGenerator<NoteAgentEvent> {
  const task: NoteAiTask = input.task ?? (input.passage ? "rewrite" : "write");
  const note = noteOverview(input.note, CURSOR_MARKER);
  const references = (input.referencedNotes ?? []).map((reference, index) => {
    const document = {
      id: `R${index + 1}`,
      title: reference.title,
      text: reference.markdown,
    };
    // Keep the full text for the tools; the overview is what the model sees.
    const { complete, text: overview } = referenceOverview(document);
    return { ...document, complete, overview };
  });

  // Fast path: a mechanical edit never needs a lookup, and when everything is
  // already in view there is nothing to look up.
  const { tools, statuses } =
    task === "mechanical"
      ? { tools: [], statuses: new Map() }
      : buildTools(input.note, note.complete, references);

  const messages: BaseMessage[] = [
    new SystemMessage(
      systemPrompt({
        task,
        tools: tools.length > 0,
        references: references.length > 0,
      }),
    ),
    new HumanMessage(
      userPrompt({
        task,
        overview: note.text,
        references: references.map((reference) => reference.overview),
        passage: input.passage,
        draft: input.draft,
        earlierPrompts: input.earlierPrompts,
        instruction: input.prompt,
      }),
    ),
  ];
  const withTools =
    tools.length && model.bindTools ? model.bindTools(tools) : null;
  const byName = new Map(tools.map((item) => [item.name, item]));

  for (let round = 0; ; round += 1) {
    const toolsAllowed = withTools !== null && round < MAX_TOOL_ROUNDS;
    if (withTools && !toolsAllowed) {
      messages.push(
        new HumanMessage(
          "Answer now with what you have; no more lookups are possible.",
        ),
      );
    }
    const runnable = toolsAllowed ? withTools : model;

    let message: AIMessageChunk | undefined;
    let held = "";
    let streaming = !toolsAllowed;
    let calledTool = false;
    for await (const chunk of await runnable.stream(
      messages,
      signal ? { signal } : {},
    )) {
      message = message ? message.concat(chunk) : chunk;
      if (chunk.tool_call_chunks?.length) calledTool = true;
      const text = messageText(chunk.content);
      if (!text) continue;
      if (streaming) {
        yield { type: "text", text };
        continue;
      }
      held += text;
      if (!calledTool && held.length >= HOLD_BACK_CHARS) {
        streaming = true;
        yield { type: "text", text: held };
        held = "";
      }
    }

    const calls = message?.tool_calls ?? [];
    // An answer (or text the model already started streaming) ends the run.
    if (!calls.length || streaming) {
      if (held && !calledTool) yield { type: "text", text: held };
      return;
    }

    messages.push(message!);
    for (const call of calls) {
      const args = (call.args ?? {}) as Record<string, unknown>;
      const status = statuses.get(call.name)?.(args);
      if (status) yield { type: "status", text: status };
      yield { type: "tool", name: call.name, args };
      const target = byName.get(call.name);
      const result = target
        ? String(await target.invoke(args))
        : `Unknown tool "${call.name}".`;
      messages.push(
        new ToolMessage({
          content: result,
          tool_call_id: call.id ?? call.name,
          name: call.name,
        }),
      );
    }
  }
}
