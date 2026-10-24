import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { GradientNamingFailure } from "./job";

export type NameInput = {
  type: "linear" | "radial";
  stops: Array<{ name: string; descriptor?: string; position: number }>;
};

/** The provider boundary for Aska's one-shot gradient naming task. */
export async function generateGradientName(input: NameInput): Promise<string> {
  const provider = process.env.GRADIENT_NAMING_PROVIDER;
  const model =
    provider === "google"
      ? google(process.env.GRADIENT_NAMING_MODEL || "gemini-3.5-flash-lite")
      : provider === "openai"
        ? openai(process.env.GRADIENT_NAMING_MODEL || "gpt-6-luna")
        : null;
  if (!model) throw new Error("Gradient naming provider is disabled");
  const { text } = await generateText({
    model,
    maxOutputTokens: 32,
    abortSignal: AbortSignal.timeout(8_000),
    system:
      "Name a color gradient. Return only one evocative but descriptive English title of 1 to 3 words in title case. Do not say gradient. Do not use an X to Y phrase, punctuation, quotes, or an explanation. Examples: navy to blue = Midnight Tide; coral to peach = Coral Glow; jade to teal = Lagoon Mist.",
    prompt: JSON.stringify(input),
  });
  return text;
}

export function classifyGradientNamingFailure(
  error: unknown,
): GradientNamingFailure {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    /api[_ ]?key|credential|unauthenticated|unauthorized|authentication|invalid key|\b401\b/.test(
      message,
    )
  )
    return "missing_api_key";
  if (/quota|rate limit|resource_exhausted|billing|\b429\b/.test(message))
    return "usage_limit";
  if (
    /timed? ?out|timeout|network|fetch failed|connection|\b50[234]\b|unavailable|overloaded/.test(
      message,
    )
  )
    return "provider_unavailable";
  return "internal_error";
}
