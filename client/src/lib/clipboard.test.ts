import { describe, expect, it } from "vitest";

import { getPreferredClipboardText } from "./clipboard";

describe("getPreferredClipboardText", () => {
  it("prefers the Markdown clipboard representation", () => {
    const clipboard = {
      getData: (type: string) =>
        type === "text/markdown" ? "# Heading\n\nBody" : "Heading Body",
    } as Pick<DataTransfer, "getData">;

    expect(getPreferredClipboardText(clipboard)).toBe("# Heading\n\nBody");
  });

  it("preserves whitespace in the plain-text fallback", () => {
    const content = "    indented code\nline with a hard break  \n";
    const clipboard = {
      getData: (type: string) => (type === "text/plain" ? content : ""),
    } as Pick<DataTransfer, "getData">;

    expect(getPreferredClipboardText(clipboard)).toBe(content);
  });
});
