/**
 * Prompt parts for the note agent, combined per request: a shared base, one task
 * part chosen by where the request came from, and the context part only when
 * tools are attached. See docs/proposals/ai-agentic-context.md.
 */

export const CURSOR_MARKER = "⟦cursor⟧";
export const SELECTION_START = "⟦selection⟧";
export const SELECTION_END = "⟦/selection⟧";

/** Where the request came from; the client knows, so nothing is guessed. */
export type NoteAgentTask = "write" | "rewrite" | "mechanical";

const BASE =
  "You are the writing assistant inside a note editor. You write Markdown that goes straight into the user's note. " +
  "Preserve headings, lists, task lists, tables, quotes, code fences, links, images, and Mermaid fences when relevant. " +
  "Do not create mention syntax or claim to link another note. Do not wrap the whole answer in a code fence. " +
  "Never output the markers ⟦cursor⟧, ⟦selection⟧ or ⟦/selection⟧.";

const TASKS: Record<NoteAgentTask, string> = {
  write:
    `Write new content for the place marked ${CURSOR_MARKER} in the note. ` +
    "Return only the content to insert, fitting what comes before and after it; never repeat the note.",
  rewrite:
    `You are editing a passage of the note; ${CURSOR_MARKER} shows where it sits, and the passage is given separately. ` +
    `The part to change is wrapped in ${SELECTION_START} and ${SELECTION_END}; without markers, the whole passage is the part to change. ` +
    "Return only the new text for that part, and nothing else: no markers, no surrounding text, no explanation. " +
    "It replaces the marked part exactly, so it must read naturally with the text right before and after it; within a sentence, return inline text without line breaks or leading and trailing spaces.",
  mechanical:
    `You are making a mechanical edit to part of the note; ${CURSOR_MARKER} shows where it sits, and the passage is given separately. ` +
    `The part to change is wrapped in ${SELECTION_START} and ${SELECTION_END}; without markers, the whole passage is the part to change. ` +
    "Do exactly what the instruction asks and nothing more: keep the meaning, tone, wording and formatting except where the instruction requires a change. " +
    "Return only the new text for that part, with no markers, surrounding text or explanation; within a sentence, return inline text.",
};

const REFERENCES =
  "Referenced items (notes, links, colors) are context the user attached: draw on them as the instruction asks, but don't copy them wholesale unless asked. " +
  "A referenced link gives only the page's details (title, description, site), not its full text: don't claim more about the page than they say. " +
  "A referenced color gives its name and value: use them as given.";

const CONTEXT_AND_TOOLS =
  "You see an overview, not everything: a long note shows its outline and the part around the cursor, and a large referenced item shows a card. " +
  "If the answer depends on content you can't see, look it up with the tools: search when you don't know where something is, then read the relevant section. " +
  "Don't look anything up when what you can see is enough. " +
  "Call tools without writing any text first; once you start the answer, write only the answer. " +
  "Never mention the tools, line numbers or this overview in the answer.";

export function systemPrompt({
  task,
  tools,
  references,
}: {
  task: NoteAgentTask;
  tools: boolean;
  references: boolean;
}) {
  return [
    BASE,
    TASKS[task],
    references && REFERENCES,
    tools && CONTEXT_AND_TOOLS,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The user message: context first, then what to do. */
export function userPrompt({
  task,
  overview,
  references,
  passage,
  draft,
  earlierPrompts = [],
  instruction,
}: {
  task: NoteAgentTask;
  overview: string;
  references: string[];
  passage?: string | undefined;
  draft?: string | undefined;
  earlierPrompts?: string[] | undefined;
  instruction: string;
}) {
  const sections = [overview, ...references];
  if (passage)
    sections.push(`Passage to edit:\n<passage>\n${passage}\n</passage>`);
  if (!draft) {
    sections.push(`Instruction:\n${instruction}`);
    return sections.join("\n\n");
  }
  if (earlierPrompts.length) {
    sections.push(
      `The draft was written for these instructions, oldest first; keep their intent unless the new instruction changes it:\n${earlierPrompts
        .map((earlier, index) => `${index + 1}. ${earlier}`)
        .join("\n")}`,
    );
  }
  const editing = task !== "write";
  sections.push(
    editing
      ? `Your previous replacement for the marked part:\n<draft>\n${draft}\n</draft>`
      : `Your previous draft at the cursor:\n<draft>\n${draft}\n</draft>`,
    editing
      ? `Revise your replacement according to this instruction and return only the new replacement for the marked part:\n${instruction}`
      : `Revise the draft according to this instruction and return the full replacement draft:\n${instruction}`,
  );
  return sections.join("\n\n");
}
