import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Suggestion from "@tiptap/suggestion";

import {
  AssetMention,
  NoteMentionProvider,
  createMentionScopeQuery,
  createMentionsExtension,
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

  it("builds the supported syntax when a scope chip is selected", () => {
    expect(createMentionScopeQuery("note", "design system")).toBe(
      "@note design system",
    );
    expect(createMentionScopeQuery("color", "note design system")).toBe(
      "@color design system",
    );
    expect(createMentionScopeQuery(undefined, "note design system")).toBe(
      "@design system",
    );
  });

  it("reads the numeric entity id from client note ids", () => {
    expect(parseNumericAssetId("note-42")).toBe(42);
    expect(parseNumericAssetId("image-42")).toBeUndefined();
  });

  it("tolerates unavailable Tiptap editor snapshots during initial render", () => {
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

  it("tolerates a destroyed editor during Strict Mode remounting", () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown, AssetMention],
      content: "Plain text",
      contentType: "markdown",
    });
    const queryClient = new QueryClient();
    editor.destroy();

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
  });

  it("uses a distinct plugin key from the slash-command suggestion", () => {
    const slashCommands = Extension.create({
      name: "testSlashCommands",
      addProseMirrorPlugins() {
        return [Suggestion({ editor: this.editor, char: "/" })];
      },
    });

    expect(() => {
      const editor = new Editor({
        extensions: [
          StarterKit.configure({ underline: false }),
          Markdown,
          AssetMention,
          slashCommands,
          createMentionsExtension({ workspaceSlug: "test" }),
        ],
        content: "Plain text",
        contentType: "markdown",
      });
      editor.destroy();
    }).not.toThrow();
  });
});
