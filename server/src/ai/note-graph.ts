import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

const NoteEditState = new StateSchema({
  prompt: z.string(),
  note: z.string(),
  draft: z.string().default(""),
  result: z.string().default(""),
});

const CURSOR_MARKER = "⟦cursor⟧";

function userMessage({
  prompt,
  note,
  draft,
}: {
  prompt: string;
  note: string;
  draft: string;
}) {
  const sections = [`Current note:\n<note>\n${note}\n</note>`];
  if (draft) {
    sections.push(
      `Your previous draft at the cursor:\n<draft>\n${draft}\n</draft>`,
      `Revise the draft according to this instruction and return the full replacement draft:\n${prompt}`,
    );
  } else {
    sections.push(`Instruction:\n${prompt}`);
  }
  return sections.join("\n\n");
}

export function createNoteEditGraph(apiKey: string) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
    maxOutputTokens: 8192,
    // The default retries a usage-limit error for most of a minute while the
    // editor shows "Writing…"; fail fast so the reason reaches the user.
    maxRetries: 1,
  });

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
