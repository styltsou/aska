export type FrontMatter = {
  /** Exact source bytes including fences and trailing newline ("" when absent). */
  raw: string;
  data: Record<string, string | string[]>;
  body: string;
};

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Splits a leading YAML front matter block from a Markdown document without
 * mutating it: `raw` preserves the exact bytes so documents round-trip.
 */
export function parseFrontMatter(markdown: string): FrontMatter {
  const match = markdown.match(FRONT_MATTER_RE);
  if (!match) {
    return { raw: "", data: {}, body: markdown };
  }

  return {
    raw: match[0],
    data: parseYamlSubset(match[1] ?? ""),
    body: markdown.slice(match[0].length),
  };
}

/** Re-attaches parsed front matter to an edited body. */
export function composeFrontMatter(
  frontMatter: Pick<FrontMatter, "raw">,
  body: string,
): string {
  return frontMatter.raw + body;
}

function parseYamlSubset(source: string): Record<string, string | string[]> {
  const data: Record<string, string | string[]> = {};
  let pendingListKey: string | null = null;

  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    if (pendingListKey && /^\s*-\s+/.test(line)) {
      const list = data[pendingListKey];
      if (Array.isArray(list)) {
        list.push(unquote(line.replace(/^\s*-\s+/, "").trim()));
      }
      continue;
    }
    pendingListKey = null;

    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    if (/[\s"'[]/.test(line.slice(0, separator))) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (!value) {
      data[key] = [];
      pendingListKey = key;
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = splitInlineList(value.slice(1, -1));
      continue;
    }

    data[key] = unquote(value);
  }

  return data;
}

function splitInlineList(source: string): string[] {
  if (!source.trim()) return [];
  return source.split(",").map((item) => unquote(item.trim()));
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
