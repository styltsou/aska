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
  filterRecentMentionTargets,
  getMentionMenuDisplayItems,
  parseMentionQuery,
  parseNumericAssetId,
  shouldShowMentionSuggestion,
} from "./note-mentions";
import {
  invalidateMentionSuggestionQueries,
  isMentionSearchCacheFresh,
  mentionSearchQueryOptions,
  RECENT_MENTION_LIMIT,
} from "@/api/note-mentions/hooks";

const target = {
  assetId: 1,
  assetType: "note" as const,
  label: "Project plan",
  title: "Project plan",
  hex: null,
  gradient: null,
  snippet: null,
  locationLabel: "Inbox",
  collectionSlug: null,
  folderPath: null,
};

describe("mention query parsing", () => {
  it("uses exact cached matches or retained results while a search is loading", () => {
    expect(
      getMentionMenuDisplayItems({
        items: [],
        cachedItems: [target],
        lastResolvedItems: [],
        loading: true,
      }),
    ).toEqual([target]);
    expect(
      getMentionMenuDisplayItems({
        items: [],
        lastResolvedItems: [target],
        loading: true,
      }),
    ).toEqual([target]);
    expect(
      getMentionMenuDisplayItems({
        items: [target],
        lastResolvedItems: [],
        loading: false,
      }),
    ).toEqual([target]);
  });

  it("keeps mention-search cache entries isolated by source, scope, and query", () => {
    const base = mentionSearchQueryOptions("test", {
      q: "project",
      sourceAssetId: 1,
    });
    const scoped = mentionSearchQueryOptions("test", {
      q: "project",
      sourceAssetId: 1,
      types: ["note"],
    });
    const differentSource = mentionSearchQueryOptions("test", {
      q: "project",
      sourceAssetId: 2,
    });

    expect(base.queryKey).not.toEqual(scoped.queryKey);
    expect(base.queryKey).not.toEqual(differentSource.queryKey);
  });

  it("filters the warm recent list by scope and supported search fields", () => {
    const gradient = {
      ...target,
      assetId: 2,
      assetType: "color" as const,
      title: null,
      hex: null,
      gradient: {
        from: "#000",
        to: "#fff",
        angle: 90,
        type: "radial" as const,
      },
    };
    const color = {
      ...gradient,
      assetId: 3,
      hex: "#BADA55",
      gradient: null,
    };

    expect(
      filterRecentMentionTargets([target, gradient, color], {
        search: "project",
      }),
    ).toEqual([target]);
    expect(
      filterRecentMentionTargets([target, gradient, color], {
        search: "gradient",
        scope: "color",
      }),
    ).toEqual([gradient]);
    expect(
      filterRecentMentionTargets([target, gradient, color], {
        search: "bada",
        scope: "color",
      }),
    ).toEqual([color]);
  });

  it("uses fresh cached searches but invalidates all mention data for one workspace", async () => {
    const queryClient = new QueryClient();
    const personal = mentionSearchQueryOptions("personal", {
      q: "",
      limit: RECENT_MENTION_LIMIT,
    });
    const shared = mentionSearchQueryOptions("shared", {
      q: "",
      limit: RECENT_MENTION_LIMIT,
    });
    queryClient.setQueryData(personal.queryKey, { targets: [target] });
    queryClient.setQueryData(shared.queryKey, { targets: [target] });

    expect(isMentionSearchCacheFresh(queryClient, personal.queryKey)).toBe(
      true,
    );
    await invalidateMentionSuggestionQueries(queryClient, "personal");

    expect(isMentionSearchCacheFresh(queryClient, personal.queryKey)).toBe(
      false,
    );
    expect(isMentionSearchCacheFresh(queryClient, shared.queryKey)).toBe(true);
  });

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

  it("dismisses a blank mention trigger but keeps multi-word searches open", () => {
    expect(shouldShowMentionSuggestion(" ")).toBe(false);
    expect(shouldShowMentionSuggestion("hello world")).toBe(true);
    expect(shouldShowMentionSuggestion("note project plan")).toBe(true);
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
