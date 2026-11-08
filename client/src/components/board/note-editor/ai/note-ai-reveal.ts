/**
 * Pacing for revealing AI output. The model sends text in a few large chunks,
 * so it's revealed a frame at a time instead: each frame shows a share of
 * what's still hidden, which reads like writing during a slow stream and
 * still catches up quickly after a large chunk. Words are never cut in half.
 */
const CATCH_UP_FRAMES = 24;
const MIN_STEP = 2;

export function nextRevealLength(text: string, shown: number) {
  const backlog = text.length - shown;
  if (backlog <= 0) return text.length;
  let end = shown + Math.max(MIN_STEP, Math.ceil(backlog / CATCH_UP_FRAMES));
  while (end < text.length && !/\s/.test(text[end] ?? "")) end++;
  return Math.min(end, text.length);
}
