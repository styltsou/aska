/**
 * Turns a model provider failure into a message the note editor can show as
 * is, so hitting a usage limit doesn't look like a bug.
 */
export function describeAiError(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);

  if (
    status === 429 ||
    /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)
  ) {
    return "AI usage limit reached. Try again later.";
  }
  if (status === 503 || /\b503\b|overloaded|UNAVAILABLE/.test(message)) {
    return "The AI model is overloaded right now. Try again in a moment.";
  }
  return "AI generation failed.";
}
