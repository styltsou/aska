import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

const NoteEditState = new StateSchema({
  prompt: z.string(),
  note: z.string(),
  draft: z.string().default(""),
  earlierPrompts: z.array(z.string()).default([]),
  result: z.string().default(""),
});

const CURSOR_MARKER = "⟦cursor⟧";

export function userMessage({
  prompt,
  note,
  draft,
  earlierPrompts = [],
}: {
  prompt: string;
  note: string;
  draft: string;
  earlierPrompts?: string[];
}) {
  const sections = [`Current note:\n<note>\n${note}\n</note>`];
  if (draft) {
    if (earlierPrompts.length) {
      sections.push(
        `The draft was written for these instructions, oldest first; keep their intent unless the new instruction changes it:\n${earlierPrompts
          .map((earlier, index) => `${index + 1}. ${earlier}`)
          .join("\n")}`,
      );
    }
    sections.push(
      `Your previous draft at the cursor:\n<draft>\n${draft}\n</draft>`,
      `Revise the draft according to this instruction and return the full replacement draft:\n${prompt}`,
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
          content:
            "You are writing at the cursor in a note. " +
            `The marker ${CURSOR_MARKER} in the note shows where your output will be inserted; never output the marker. ` +
            "Return only the new content to insert as Markdown; never repeat the current note. " +
            "Preserve headings, lists, task lists, tables, quotes, code fences, links, images, and Mermaid fences when relevant. " +
            "Do not create mention syntax or claim to link another note. Do not wrap the whole answer in a code fence.",
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
