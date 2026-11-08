/**
 * Pacing for revealing AI output. The model sends text in a few large chunks,
 * so it's revealed gradually instead: over each interval a share of what's
 * still hidden appears, which reads like writing during a slow stream and
 * still catches up quickly after a large chunk. Pacing follows elapsed time,
 * not frames, so throttled or slow frames don't stretch it out. Words are
 * never cut in half.
 */
// Time constant of the catch-up: after this long, ~63% of the backlog shows.
const CATCH_UP_MS = 350;
// Floor so the tail of a reveal doesn't crawl.
const MIN_CHARS_PER_SECOND = 150;

export function nextRevealLength(
  text: string,
  shown: number,
  elapsedMs: number,
) {
  const backlog = text.length - shown;
  if (backlog <= 0) return text.length;
  const elapsed = Math.max(0, elapsedMs);
  const share = backlog * (1 - Math.exp(-elapsed / CATCH_UP_MS));
  const floor = (MIN_CHARS_PER_SECOND * elapsed) / 1000;
  let end = shown + Math.max(1, Math.ceil(Math.max(share, floor)));
  while (end < text.length && !/\s/.test(text[end] ?? "")) end++;
  return Math.min(end, text.length);
}
