import {
  NOTE_MENTION_CHIP_CLASS,
  NOTE_MENTION_CHIP_HOVER_CLASS,
  MentionPillBody,
} from "./note-mention-visuals";
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
  getMentionSearchFallback,
  getMentionSelectionIndex,
  getMentionTargetSignature,
  nextMentionScope,
  parseMentionQuery,
  parseNumericAssetId,
  shouldShowMentionSuggestion,
} from "./note-mentions";
import {
  invalidateMentionSuggestionQueries,
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
  it("keeps hover affordances off the shared base pill", () => {
    expect(NOTE_MENTION_CHIP_CLASS).not.toContain("hover:");
    expect(NOTE_MENTION_CHIP_CLASS).not.toContain("cursor-pointer");
    expect(NOTE_MENTION_CHIP_HOVER_CLASS).toContain("cursor-pointer");
    expect(NOTE_MENTION_CHIP_HOVER_CLASS).toContain("hover:");
  });

  it("retains scoped cached images across invalidation and isolates sources", async () => {
    const client = new QueryClient();
    const image = {
      ...target,
      assetId: 2,
      assetType: "image" as const,
      title: null,
      label: "Landscape",
    };
    const options = mentionSearchQueryOptions("personal", {
      q: "",
      sourceAssetId: 10,
      types: ["image"],
    });
    client.setQueryData(options.queryKey, { targets: [image] });
    await invalidateMentionSuggestionQueries(client, "personal");
    expect(
      getMentionSearchFallback(client, "personal", 10, {
        scope: "image",
        search: "",
      }),
    ).toEqual({ targets: [image] });
    expect(
      getMentionSearchFallback(client, "personal", 10, {
        scope: "image",
        search: "land",
      }),
    ).toEqual({ targets: [image] });
    expect(
      getMentionSearchFallback(client, "personal", 10, {
        scope: "note",
        search: "",
      }),
    ).toBeUndefined();
    expect(
      getMentionSearchFallback(client, "other", 10, { search: "" }),
    ).toBeUndefined();
    expect(
      getMentionSearchFallback(client, "personal", 11, { search: "" }),
    ).toBeUndefined();
    expect(
      getMentionSearchFallback(client, "personal", 10, { search: "unrelated" }),
    ).toBeUndefined();
    client.clear();
  });

  it("keeps selection on the same target when results reorder", () => {
    const other = { ...target, assetId: 2 };
    expect(getMentionSelectionIndex([target, other], "note:2")).toBe(1);
    expect(getMentionSelectionIndex([other, target], "note:2")).toBe(0);
    expect(getMentionSelectionIndex([target], "note:2")).toBe(0);
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
      title: "Radial Gradient",
      label: "Radial Gradient",
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
      title: "Spring Green",
      label: "Spring Green",
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

    expect(queryClient.getQueryState(personal.queryKey)?.isInvalidated).toBe(
      false,
    );
    await invalidateMentionSuggestionQueries(queryClient, "personal");

    expect(queryClient.getQueryState(personal.queryKey)?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(shared.queryKey)?.isInvalidated).toBe(
      false,
    );
  });

  it("recognizes explicit note, color, and image scopes", () => {
    expect(parseMentionQuery("note: design system")).toEqual({
      scope: "note",
      search: "design system",
    });
    expect(parseMentionQuery("color:")).toEqual({
      scope: "color",
      search: "",
    });
    expect(parseMentionQuery("image: sunset")).toEqual({
      scope: "image",
      search: "sunset",
    });
  });

  it("keeps ordinary queries unscoped", () => {
    expect(parseMentionQuery("noteworthy")).toEqual({ search: "noteworthy" });
  });

  it("dismisses a blank mention trigger but keeps multi-word searches open", () => {
    expect(shouldShowMentionSuggestion(" ")).toBe(false);
    expect(shouldShowMentionSuggestion("hello world")).toBe(true);
    expect(shouldShowMentionSuggestion("note: project plan")).toBe(true);
  });

  it("builds the supported syntax when a scope chip is selected", () => {
    expect(createMentionScopeQuery("note", "design system")).toBe(
      "@note:design system",
    );
    expect(createMentionScopeQuery("color", "note: design system")).toBe(
      "@color:design system",
    );
    expect(createMentionScopeQuery("image", "landscape")).toBe(
      "@image:landscape",
    );
    expect(createMentionScopeQuery(undefined, "note: design system")).toBe(
      "@design system",
    );
  });

  it("cycles mention filters in both directions and wraps at either end", () => {
    expect(nextMentionScope(undefined, false)).toBe("note");
    expect(nextMentionScope("note", false)).toBe("color");
    expect(nextMentionScope("link", false)).toBeUndefined();
    expect(nextMentionScope(undefined, true)).toBe("link");
    expect(nextMentionScope("color", true)).toBe("note");
    expect(
      createMentionScopeQuery(
        nextMentionScope("note", false),
        "note: design system",
      ),
    ).toBe("@color:design system");
  });

  it("reserves a color swatch and renders the note icon before resolution", () => {
    const color = renderToStaticMarkup(
      createElement(MentionPillBody, { assetType: "color", label: "A color" }),
    );
    const note = renderToStaticMarkup(
      createElement(MentionPillBody, { assetType: "note", label: "A note" }),
    );
    expect(color).toContain("bg-muted");
    expect(color).toContain("size-3.5");
    expect(note).toContain("lucide-file-text");
  });

  it("renders an image mention with its preview or image fallback", () => {
    const fallback = renderToStaticMarkup(
      createElement(MentionPillBody, {
        assetType: "image",
        label: "A landscape",
      }),
    );
    const preview = renderToStaticMarkup(
      createElement(MentionPillBody, {
        assetType: "image",
        label: "A landscape",
        previewUrl: "https://media.example/landscape.webp",
      }),
    );

    expect(fallback).toContain("lucide-image");
    expect(preview).toContain("https://media.example/landscape.webp");
  });

  it("renders a video poster without a play badge in the mention pill", () => {
    const preview = renderToStaticMarkup(
      createElement(MentionPillBody, {
        assetType: "video",
        label: "A clip",
        previewUrl: "https://media.example/poster.webp",
      }),
    );

    expect(preview).toContain("https://media.example/poster.webp");
    expect(preview).not.toContain("lucide-play");
  });

  it("resolves video mentions alongside other mentions", () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown, AssetMention],
      content: "[A note](note:4) and [A clip](video:9) and [The clip](video:9)",
      contentType: "markdown",
    });

    expect(getMentionTargetSignature(editor.state.doc)).toBe("note:4,video:9");
    editor.destroy();
  });

  it("reads the numeric entity id from client note ids", () => {
    expect(parseNumericAssetId("note-42")).toBe(42);
    expect(parseNumericAssetId("image-42")).toBe(42);
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
            // createElement's types require the required children prop here.
            // eslint-disable-next-line react/no-children-prop
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
            // createElement's types require the required children prop here.
            // eslint-disable-next-line react/no-children-prop
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
