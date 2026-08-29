export type NoteMentionType = "note" | "color";

export type ParsedNoteMention = {
  targetAssetId: number;
  targetType: NoteMentionType;
  fallbackLabel: string;
  start: number;
  end: number;
};

const MENTION_DESTINATION = /^(note|color):(\d+)$/;
const FENCE_START = /^ {0,3}(`{3,}|~{3,})/;

export function escapeMentionLabel(label: string): string {
  return (
    label
      .trim()
      .replace(/[\\\]]/g, "_")
      .slice(0, 255) || "Untitled"
  );
}

export function extractNoteMentions(markdown: string): ParsedNoteMention[] {
  const mentions: ParsedNoteMention[] = [];
  let offset = 0;
  let fence: { marker: string; length: number } | undefined;

  for (const lineWithBreak of markdown.match(/.*(?:\n|$)/g) ?? []) {
    if (!lineWithBreak) continue;
    const line = lineWithBreak.endsWith("\n")
      ? lineWithBreak.slice(0, -1)
      : lineWithBreak;
    const fenceMatch = line.match(FENCE_START);
    if (fenceMatch) {
      const run = fenceMatch[1]!;
      if (!fence) fence = { marker: run[0]!, length: run.length };
      else if (run[0] === fence.marker && run.length >= fence.length)
        fence = undefined;
      offset += lineWithBreak.length;
      continue;
    }

    if (!fence) scanInlineMentions(line, offset, mentions);
    offset += lineWithBreak.length;
  }

  return mentions;
}

export function rewriteNoteMentionLabels(
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string {
  const matches = extractNoteMentions(markdown).filter((mention) =>
    replacements.has(mentionKey(mention.targetType, mention.targetAssetId)),
  );
  if (matches.length === 0) return markdown;

  let rewritten = markdown;
  for (const mention of matches.toReversed()) {
    const label = replacements.get(
      mentionKey(mention.targetType, mention.targetAssetId),
    );
    if (!label) continue;
    rewritten = `${rewritten.slice(0, mention.start)}[${escapeMentionLabel(label)}](${mention.targetType}:${mention.targetAssetId})${rewritten.slice(mention.end)}`;
  }
  return rewritten;
}

export function mentionKey(type: NoteMentionType, assetId: number): string {
  return `${type}:${assetId}`;
}

function scanInlineMentions(
  line: string,
  lineOffset: number,
  mentions: ParsedNoteMention[],
) {
  let index = 0;
  let codeDelimiterLength = 0;

  while (index < line.length) {
    if (line[index] === "`" && !isEscaped(line, index)) {
      const runLength = countRun(line, index, "`");
      if (codeDelimiterLength === 0) codeDelimiterLength = runLength;
      else if (runLength === codeDelimiterLength) codeDelimiterLength = 0;
      index += runLength;
      continue;
    }
    if (
      codeDelimiterLength > 0 ||
      line[index] !== "[" ||
      line[index - 1] === "!" ||
      isEscaped(line, index)
    ) {
      index += 1;
      continue;
    }

    const labelEnd = findUnescaped(line, "]", index + 1);
    if (labelEnd < 0 || line[labelEnd + 1] !== "(") {
      index += 1;
      continue;
    }
    const destinationEnd = findUnescaped(line, ")", labelEnd + 2);
    if (destinationEnd < 0) {
      index += 1;
      continue;
    }
    const destination = line.slice(labelEnd + 2, destinationEnd);
    const destinationMatch = destination.match(MENTION_DESTINATION);
    if (!destinationMatch) {
      index = destinationEnd + 1;
      continue;
    }
    const targetAssetId = Number(destinationMatch[2]);
    if (!Number.isSafeInteger(targetAssetId) || targetAssetId <= 0) {
      index = destinationEnd + 1;
      continue;
    }

    mentions.push({
      targetAssetId,
      targetType: destinationMatch[1] as NoteMentionType,
      fallbackLabel: line
        .slice(index + 1, labelEnd)
        .replace(/\\([\\\]])/g, "$1"),
      start: lineOffset + index,
      end: lineOffset + destinationEnd + 1,
    });
    index = destinationEnd + 1;
  }
}

function countRun(value: string, start: number, character: string): number {
  let end = start;
  while (value[end] === character) end += 1;
  return end - start;
}

function findUnescaped(value: string, character: string, start: number) {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === character && !isEscaped(value, index)) return index;
  }
  return -1;
}

function isEscaped(value: string, index: number): boolean {
  let slashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && value[cursor] === "\\";
    cursor -= 1
  )
    slashes += 1;
  return slashes % 2 === 1;
}
