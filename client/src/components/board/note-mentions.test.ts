import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import {
  AssetMention,
  NoteMentionProvider,
  parseMentionQuery,
  parseNumericAssetId,
} from "./note-mentions";

describe("mention query parsing", () => {
  it("recognizes explicit note and color scopes", () => {
    expect(parseMentionQuery("note design system")).toEqual({
      scope: "note",
      search: "design system",
    });
    expect(parseMentionQuery("color ")).toEqual({
      scope: "color",
      search: "",
    });
  });

  it("keeps ordinary queries unscoped", () => {
    expect(parseMentionQuery("noteworthy")).toEqual({ search: "noteworthy" });
  });

  it("reads the numeric entity id from client note ids", () => {
    expect(parseNumericAssetId("note-42")).toBe(42);
    expect(parseNumericAssetId("image-42")).toBeUndefined();
  });

  it("tolerates Tiptap's null editor snapshot during initial render", () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown, AssetMention],
      content: "Plain text",
      contentType: "markdown",
    });
    const queryClient = new QueryClient();

    expect(() =>
      renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(NoteMentionProvider, {
            editor,
            workspaceSlug: "test",
            sourceAssetId: 42,
            children: createElement("div", null, "Editor content"),
          }),
        ),
      ),
    ).not.toThrow();

    editor.destroy();
  });
});
