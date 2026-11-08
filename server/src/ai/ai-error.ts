/**
 * Turns a model provider failure into a message the note editor can show as
 * is, so hitting a usage limit doesn't look like a bug. Matches HTTP statuses
 * and common wording rather than one provider's error types, so it holds when
 * `createNoteModel` switches providers.
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
  // 529 and "overloaded" are how some providers (e.g. Anthropic) say it.
  if (
    status === 503 ||
    status === 529 ||
    /\b(503|529)\b|overloaded|UNAVAILABLE/i.test(message)
  ) {
    return "The AI model is overloaded right now. Try again in a moment.";
  }
  return "AI generation failed.";
}
