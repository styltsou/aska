import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

const NoteEditState = new StateSchema({
  prompt: z.string(),
  note: z.string(),
  draft: z.string().default(""),
  earlierPrompts: z.array(z.string()).default([]),
  /** For a rewrite: the passage being rewritten, selection marked. */
  passage: z.string().default(""),
  /** Notes the user @-mentioned in the prompt, as context. */
  referencedNotes: z
    .array(z.object({ title: z.string(), markdown: z.string() }))
    .default([]),
  result: z.string().default(""),
});

const CURSOR_MARKER = "⟦cursor⟧";
const SELECTION_START = "⟦selection⟧";
const SELECTION_END = "⟦/selection⟧";

const FORMAT_RULES =
  "Notes the user referenced are context: draw on them as the instruction asks, but never copy them wholesale unless asked. " +
  "Preserve headings, lists, task lists, tables, quotes, code fences, links, images, and Mermaid fences when relevant. " +
  "Do not create mention syntax or claim to link another note. Do not wrap the whole answer in a code fence.";

export function systemMessage({ passage }: { passage?: string }) {
  if (passage) {
    return (
      "You are editing a passage of a note. " +
      `The marker ${CURSOR_MARKER} in the note shows where the passage sits; the passage itself is given separately. ` +
      `The part to change is wrapped in ${SELECTION_START} and ${SELECTION_END}; when there are no markers, the whole passage is the part to change. ` +
      "Return only the new text for that part, as Markdown, and nothing else: no markers, no surrounding text, no explanation. " +
      "It replaces the marked part exactly, so it must read naturally with the text right before and after it; when the part is within a sentence, return inline text without line breaks or leading and trailing spaces. " +
      FORMAT_RULES
    );
  }
  return (
    "You are writing at the cursor in a note. " +
    `The marker ${CURSOR_MARKER} in the note shows where your output will be inserted; never output the marker. ` +
    "Return only the new content to insert as Markdown; never repeat the current note. " +
    FORMAT_RULES
  );
}

export function userMessage({
  prompt,
  note,
  draft,
  earlierPrompts = [],
  passage = "",
  referencedNotes = [],
}: {
  prompt: string;
  note: string;
  draft: string;
  earlierPrompts?: string[];
  passage?: string;
  referencedNotes?: Array<{ title: string; markdown: string }>;
}) {
  const sections = [`Current note:\n<note>\n${note}\n</note>`];
  for (const referenced of referencedNotes) {
    sections.push(
      `Referenced note "${referenced.title}":\n<referenced-note>\n${referenced.markdown}\n</referenced-note>`,
    );
  }
  if (passage) {
    sections.push(`Passage to edit:\n<passage>\n${passage}\n</passage>`);
  }
  if (draft) {
    if (earlierPrompts.length) {
      sections.push(
        `The draft was written for these instructions, oldest first; keep their intent unless the new instruction changes it:\n${earlierPrompts
          .map((earlier, index) => `${index + 1}. ${earlier}`)
          .join("\n")}`,
      );
    }
    sections.push(
      passage
        ? `Your previous replacement for the marked part:\n<draft>\n${draft}\n</draft>`
        : `Your previous draft at the cursor:\n<draft>\n${draft}\n</draft>`,
      passage
        ? `Revise your replacement according to this instruction and return only the new replacement for the marked part:\n${prompt}`
        : `Revise the draft according to this instruction and return the full replacement draft:\n${prompt}`,
    );
  } else {
    sections.push(`Instruction:\n${prompt}`);
  }
  return sections.join("\n\n");
}

/**
 * Writes or revises the draft at the cursor. Provider-agnostic: pass any chat
 * model (see `createNoteModel`); streaming the graph in "messages" mode yields
 * the model's output as it is generated.
 */
export function createNoteEditGraph(model: BaseChatModel) {
  return new StateGraph(NoteEditState)
    .addNode("write", async (state) => {
      const response = await model.invoke([
        {
          role: "system",
          content: systemMessage(state),
        },
        {
          role: "user",
          content: userMessage(state),
        },
      ]);
      return {
        result:
          typeof response.content === "string"
            ? response.content
            : response.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join(""),
      };
    })
    .addEdge(START, "write")
    .addEdge("write", END)
    .compile();
}
