type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
  };
};

const HIGHLIGHT_PATTERN =
  /==([^=\n]+)==|\[highlight\s+color="(amber|mint|sky|rose|lavender)"\]([^\n]*?)\[\/highlight\]/g;

/** Renders Tiptap's `==highlight==` Markdown as semantic mark elements. */
export function remarkHighlight() {
  return (tree: MarkdownNode) => visit(tree);
}

function visit(node: MarkdownNode) {
  if (!node.children || node.type === "code" || node.type === "inlineCode") {
    return;
  }

  const nextChildren: MarkdownNode[] = [];
  for (const child of node.children) {
    if (
      child.type !== "text" ||
      (!child.value?.includes("==") && !child.value?.includes("[highlight"))
    ) {
      visit(child);
      nextChildren.push(child);
      continue;
    }

    let cursor = 0;
    HIGHLIGHT_PATTERN.lastIndex = 0;
    for (const match of child.value.matchAll(HIGHLIGHT_PATTERN)) {
      const index = match.index;
      if (index > cursor) {
        nextChildren.push({
          type: "text",
          value: child.value.slice(cursor, index),
        });
      }
      nextChildren.push({
        type: "emphasis",
        data: {
          hName: "mark",
          hProperties: {
            class: "note-highlight",
            "data-highlight-color": match[2] ?? "amber",
          },
        },
        children: [{ type: "text", value: match[1] ?? match[3] ?? "" }],
      });
      cursor = index + match[0].length;
    }
    if (cursor < child.value.length) {
      nextChildren.push({ type: "text", value: child.value.slice(cursor) });
    }
  }

  node.children = nextChildren;
}
