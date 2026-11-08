import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

/**
 * The one place that knows which provider and model write in notes.
 * Everything downstream (the graph, the stream, the client) works with any
 * LangChain chat model, so switching providers means changing this function
 * and the secret it reads, nothing else.
 *
 * Returns null when the provider isn't configured.
 */
export function createNoteModel(
  env: Record<string, string | undefined> = process.env,
): BaseChatModel | null {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
    maxOutputTokens: 8192,
    // The default retries a usage-limit error for most of a minute while the
    // editor shows "Writing…"; fail fast so the reason reaches the user.
    maxRetries: 1,
  });
}
