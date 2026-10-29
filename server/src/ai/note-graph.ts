import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

const NoteEditState = new StateSchema({
  prompt: z.string(),
  note: z.string(),
  result: z.string().default(""),
});

export function createNoteEditGraph(apiKey: string) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
    maxOutputTokens: 8192,
  });

  return new StateGraph(NoteEditState)
    .addNode("write", async (state) => {
      const response = await model.invoke([
        {
          role: "system",
          content:
            "You are writing at the cursor in a note. Return only the new content to insert as Markdown; never repeat the current note. " +
            "Preserve headings, lists, task lists, tables, quotes, code fences, links, images, and Mermaid fences when relevant. " +
            "Do not create mention syntax or claim to link another note. Do not wrap the whole answer in a code fence.",
        },
        {
          role: "user",
          content: `Current note:\n<note>\n${state.note}\n</note>\n\nInstruction:\n${state.prompt}`,
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
