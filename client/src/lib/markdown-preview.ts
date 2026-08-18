const FENCE_RE = /^\s*(`{3,}|~{3,})/;

/**
 * Bounds Markdown for compact card previews without flattening its block
 * structure. Newlines and indentation are meaningful Markdown syntax.
 */
export function makeMarkdownPreview(content: string, maxLength = 1000): string {
  const normalized = content.replace(/\r\n?/g, "\n");
  if (normalized.length <= maxLength) return normalized;

  let preview = normalized.slice(0, maxLength);
  const openFence = findOpenFence(preview);
  if (openFence) {
    preview += `${preview.endsWith("\n") ? "" : "\n"}${openFence}`;
  }

  return `${preview}\n\n…`;
}

function findOpenFence(content: string): string | undefined {
  let openFence: string | undefined;

  for (const line of content.split("\n")) {
    const match = line.match(FENCE_RE);
    if (!match) continue;

    const fence = match[1]!;
    if (
      openFence &&
      fence[0] === openFence[0] &&
      fence.length >= openFence.length
    ) {
      openFence = undefined;
    } else if (!openFence) {
      openFence = fence;
    }
  }

  return openFence;
}
