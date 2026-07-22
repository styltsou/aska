import { describe, expect, it } from "vitest";

import {
  firstPreviewRowsByParent,
  makeSnippet,
  toBoardPosition,
  toFolderPreview,
} from "./collection-node-mappers";

describe("collection node mappers", () => {
  it("preserves complete board positions and treats partial positions as absent", () => {
    expect(toBoardPosition(48, 96)).toEqual({ x: 48, y: 96 });
    expect(toBoardPosition(null, 96)).toBeNull();
  });

  it("limits previews independently for each folder", () => {
    const rows = [
      { folderId: 1, id: "a" },
      { folderId: 1, id: "b" },
      { folderId: 2, id: "c" },
      { folderId: 1, id: "d" },
    ];

    expect(firstPreviewRowsByParent(rows, (row) => row.folderId, 2)).toEqual([
      rows[0],
      rows[1],
      rows[2],
    ]);
  });

  it("maps image and note folder previews", () => {
    const imageVariants = new Map([
      [
        7,
        {
          preview: {
            objectKey: "assets/7/preview.webp",
            width: 200,
            height: 100,
            contentType: "image/webp",
            sizeBytes: 100,
            url: "https://example.test/preview.webp",
          },
          blurDataURL: "data:image/webp;base64,AA==",
        },
      ],
    ]);

    expect(
      toFolderPreview(
        {
          folderId: 1,
          assetType: "image",
          assetId: 7,
          color: null,
          content: null,
        },
        imageVariants,
      ),
    ).toMatchObject({
      assetId: "image-7",
      type: "image",
      url: "https://example.test/preview.webp",
    });
    expect(
      toFolderPreview(
        {
          folderId: 1,
          assetType: "note",
          assetId: 8,
          color: "yellow",
          content: "One\n two",
        },
        imageVariants,
      ),
    ).toEqual({
      assetId: "note-8",
      type: "note",
      color: "yellow",
      snippet: "One two",
    });
  });

  it("normalizes and bounds note snippets", () => {
    expect(makeSnippet("  One\n two  ")).toBe("One two");
    expect(makeSnippet("abcdef", 4)).toBe("abcd…");
  });
});
