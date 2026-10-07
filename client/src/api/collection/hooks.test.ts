import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { colorSearchQueryKeys } from "@/api/color-search/hooks";

import {
  applyColorDraftToContents,
  applyUpdatedColorToContents,
  collectionQueryKeys,
} from "./hooks";
import type {
  CollectionContentsResponse,
  CollectionFolderNode,
  FolderChildPreview,
  CollectionNode,
  CollectionNoteNode,
} from "./types";

describe("collection query keys", () => {
  it("invalidates cached counts at every folder level in one collection", async () => {
    const queryClient = new QueryClient();
    const rootKey = collectionQueryKeys.contents("personal", "reference");
    const nestedKey = collectionQueryKeys.contents(
      "personal",
      "reference",
      "type/serif",
    );
    const otherCollectionKey = collectionQueryKeys.contents(
      "personal",
      "inspiration",
    );

    queryClient.setQueryData(rootKey, { nodes: [] });
    queryClient.setQueryData(nestedKey, { nodes: [] });
    queryClient.setQueryData(otherCollectionKey, { nodes: [] });

    await queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.contentScope("personal", "reference"),
      refetchType: "none",
    });

    expect(queryClient.getQueryState(rootKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(nestedKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherCollectionKey)?.isInvalidated).toBe(
      false,
    );
  });
});

describe("color search query keys", () => {
  it("invalidates color-search results only for the affected workspace", async () => {
    const queryClient = new QueryClient();
    const personalKey = colorSearchQueryKeys.search(
      "personal",
      "inbox",
      "0.5:0.1:0.2:1",
      "weighted",
    );
    const sharedKey = colorSearchQueryKeys.search(
      "shared",
      "inbox",
      "0.5:0.1:0.2:1",
      "weighted",
    );

    queryClient.setQueryData(personalKey, { results: [] });
    queryClient.setQueryData(sharedKey, { results: [] });

    await queryClient.invalidateQueries({
      queryKey: colorSearchQueryKeys.workspace("personal"),
      refetchType: "none",
    });

    expect(queryClient.getQueryState(personalKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(sharedKey)?.isInvalidated).toBe(false);
  });
});

function noteNode(
  overrides: Partial<CollectionNoteNode> = {},
): CollectionNoteNode {
  return {
    id: "note-5",
    type: "note",
    content: "Use [Ocean](color:7).",
    title: "Palette",
    isFavorite: false,
    wordCount: 3,
    readingTimeMinutes: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    position: null,
    frontIndex: null,
    mentionColors: {
      "color:7": { hex: "#0a5", gradient: null },
      "color:8": { hex: "#f00", gradient: null },
    },
    ...overrides,
  };
}

function contentsWith(nodes: CollectionNode[]): CollectionContentsResponse {
  return {
    collection: { id: 1, name: "Ref", slug: "ref" },
    breadcrumbs: [],
    nodes,
    canvasObjects: [],
  };
}

function contentsWithMention(): CollectionContentsResponse {
  return contentsWith([noteNode()]);
}

function folderNode(previews: FolderChildPreview[]): CollectionFolderNode {
  return {
    id: "folder-1",
    type: "folder",
    name: "Refs",
    slug: "refs",
    count: previews.length,
    folderCount: 0,
    previews,
    createdAt: "2026-01-01T00:00:00.000Z",
    position: null,
  };
}

describe("color edits repainting mention swatches", () => {
  const updated = {
    id: "color-7",
    type: "color" as const,
    hex: "#00f",
    note: null,
    updatedAt: "2026-01-02T00:00:00.000Z",
    title: "Ink",
    isFavorite: false,
    gradient: null,
  };

  it("patches the edited color in a note's mention colors", () => {
    const next = applyUpdatedColorToContents(contentsWithMention(), updated);
    const node = next!.nodes[0]!;

    expect(node.type).toBe("note");
    if (node.type !== "note") throw new Error("expected a note node");
    expect(node.mentionColors!["color:7"]).toEqual({
      hex: "#00f",
      gradient: null,
      label: "Ink",
    });
  });

  it("leaves other referenced colors untouched", () => {
    const next = applyUpdatedColorToContents(contentsWithMention(), updated);
    const node = next!.nodes[0]!;
    if (node.type !== "note") throw new Error("expected a note node");

    expect(node.mentionColors!["color:8"]).toEqual({
      hex: "#f00",
      gradient: null,
    });
  });

  it("does not invent an entry for a color the note never referenced", () => {
    const next = applyUpdatedColorToContents(contentsWithMention(), {
      ...updated,
      id: "color-42",
    });
    const node = next!.nodes[0]!;
    if (node.type !== "note") throw new Error("expected a note node");

    expect(node.mentionColors!["color:42"]).toBeUndefined();
    expect(Object.keys(node.mentionColors!)).toHaveLength(2);
  });

  it("applies a draft before the server responds, preserving untouched fields", () => {
    const next = applyColorDraftToContents(contentsWithMention(), {
      assetId: "color-7",
      hex: "#123456",
    });
    const node = next!.nodes[0]!;
    if (node.type !== "note") throw new Error("expected a note node");

    expect(node.mentionColors!["color:7"]!.hex).toBe("#123456");
  });

  it("keeps the existing gradient when only the hex is drafted", () => {
    const withGradient = contentsWith([
      noteNode({
        mentionColors: {
          "color:7": {
            hex: "#0a5",
            gradient: { from: "#f00", to: "#00f", angle: 90 },
          },
        },
      }),
    ]);

    const next = applyColorDraftToContents(withGradient, {
      assetId: "color-7",
      hex: "#123456",
    });
    const node = next!.nodes[0]!;
    if (node.type !== "note") throw new Error("expected a note node");

    expect(node.mentionColors!["color:7"]!.gradient).toEqual({
      from: "#f00",
      to: "#00f",
      angle: 90,
    });
  });

  it("leaves a note without mention colors alone", () => {
    const bare = contentsWith([noteNode({ mentionColors: undefined })]);

    expect(() => applyUpdatedColorToContents(bare, updated)).not.toThrow();
  });
  it("repaints a note preview nested inside a folder node", () => {
    const withFolder = contentsWith([
      folderNode([
        {
          assetId: "note-5",
          type: "note",
          snippet: "Use [Ocean](color:7).",
          mentionColors: { "color:7": { hex: "#0a5", gradient: null } },
        },
      ]),
    ]);

    const next = applyUpdatedColorToContents(withFolder, updated);
    const folder = next!.nodes[0]!;
    if (folder.type !== "folder") throw new Error("expected a folder node");

    expect(folder.previews[0]!.mentionColors!["color:7"]).toEqual({
      hex: "#00f",
      gradient: null,
      label: "Ink",
    });
  });

  it("updates the gradient on a color preview inside a folder node", () => {
    const withColorFolder = contentsWith([
      folderNode([
        { assetId: "color-7", type: "color", hex: "#0a5", gradient: null },
      ]),
    ]);

    const next = applyUpdatedColorToContents(withColorFolder, {
      ...updated,
      gradient: { from: "#0f0", to: "#00f", angle: 45 },
    });
    const folder = next!.nodes[0]!;
    if (folder.type !== "folder") throw new Error("expected a folder node");

    expect(folder.previews[0]!.gradient).toEqual({
      from: "#0f0",
      to: "#00f",
      angle: 45,
    });
  });

  it("leaves a nested preview that never referenced the color alone", () => {
    const withUnrelated = contentsWith([
      folderNode([
        {
          assetId: "note-9",
          type: "note",
          snippet: "Mentions nothing relevant.",
          mentionColors: { "color:99": { hex: "#123", gradient: null } },
        },
      ]),
    ]);

    const next = applyUpdatedColorToContents(withUnrelated, updated);
    const folder = next!.nodes[0]!;
    if (folder.type !== "folder") throw new Error("expected a folder node");

    expect(folder.previews[0]!.mentionColors).toEqual({
      "color:99": { hex: "#123", gradient: null },
    });
  });
});
