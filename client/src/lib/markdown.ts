export function markdownFromSelection(range: Range, selection: Selection) {
  const markdown = markdownFromNode(range.cloneContents()).trim();
  return markdown || selection.toString().trim();
}

function markdownFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return markdownFromChildren(node).trim();
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case "br":
      return "\n";
    case "p":
      return blockMarkdown(markdownFromChildren(element));
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Number(tagName.slice(1));
      return blockMarkdown(
        `${"#".repeat(level)} ${markdownFromChildren(element).trim()}`,
      );
    }
    case "blockquote":
      return blockMarkdown(
        markdownFromChildren(element)
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
      );
    case "ul":
    case "ol":
      return listMarkdown(element, tagName === "ol");
    case "li":
      return markdownFromChildren(element).trim();
    case "pre":
      return blockMarkdown(
        `\`\`\`\n${element.textContent?.trimEnd() ?? ""}\n\`\`\``,
      );
    case "code":
      if (element.parentElement?.tagName.toLowerCase() === "pre") {
        return element.textContent ?? "";
      }
      return inlineCodeMarkdown(element.textContent ?? "");
    case "a": {
      const label = markdownFromChildren(element).trim();
      const href = element.getAttribute("href");
      return href && label ? `[${label}](${href})` : label;
    }
    case "strong":
    case "b":
      return `**${markdownFromChildren(element).trim()}**`;
    case "em":
    case "i":
      return `*${markdownFromChildren(element).trim()}*`;
    case "del":
    case "s":
      return `~~${markdownFromChildren(element).trim()}~~`;
    case "hr":
      return blockMarkdown("---");
    default:
      return markdownFromChildren(element);
  }
}

function markdownFromChildren(node: Node): string {
  return Array.from(node.childNodes)
    .map((child) => markdownFromNode(child))
    .join("");
}

function blockMarkdown(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${trimmed}\n\n` : "";
}

function listMarkdown(element: HTMLElement, ordered: boolean): string {
  const items = Array.from(element.children).filter(
    (child): child is HTMLElement => child.tagName.toLowerCase() === "li",
  );

  return blockMarkdown(
    items
      .map((item, index) => {
        const prefix = ordered ? `${index + 1}. ` : "- ";
        return `${prefix}${markdownFromChildren(item).trim().replace(/\n/g, "\n  ")}`;
      })
      .join("\n"),
  );
}

function inlineCodeMarkdown(value: string): string {
  const fence = value.includes("`") ? "``" : "`";
  return `${fence}${value}${fence}`;
}
