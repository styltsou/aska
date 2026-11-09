import { describe, expect, it } from "vitest";

import { userMessage } from "./note-agent";
import {
  attachImages,
  imageVariantForModel,
  referenceFromRow,
  type MentionRow,
} from "./mentioned-assets";

const empty: MentionRow = {
  id: 1,
  type: "note",
  title: null,
  noteMarkdown: null,
  linkUrl: null,
  linkNote: null,
  resourceTitle: null,
  resourceUrl: null,
  hostname: null,
  siteName: null,
  description: null,
  resourceKind: null,
  colorHex: null,
  colorGradient: null,
  colorNote: null,
  imageWidth: null,
  imageHeight: null,
  imageAlt: null,
  imageNote: null,
  imageSourceLabel: null,
  imageSourceUrl: null,
  imageColors: null,
  imageVariants: null,
};

describe("referenceFromRow", () => {
  it("passes a note's Markdown through", () => {
    expect(
      referenceFromRow({ ...empty, title: "", noteMarkdown: "# Plan" }),
    ).toEqual({ kind: "note", title: "Untitled", text: "# Plan" });
  });

  it("summarizes a link from its stored details, skipping empty ones", () => {
    expect(
      referenceFromRow({
        ...empty,
        type: "link",
        linkUrl: "https://example.test/a?ref=x",
        resourceTitle: "Launch plan",
        resourceUrl: "https://example.test/a",
        hostname: "example.test",
        description: "  ",
        resourceKind: "web_page",
      }),
    ).toEqual({
      kind: "link",
      title: "Launch plan",
      text: [
        "Title: Launch plan",
        "URL: https://example.test/a",
        "Site: example.test",
        "Kind: web_page",
      ].join("\n"),
    });
  });

  it("describes a solid color and a gradient", () => {
    expect(
      referenceFromRow({
        ...empty,
        type: "color",
        title: "Deep teal",
        colorHex: "#0f766e",
        colorNote: "Accent",
      })?.text,
    ).toBe("Name: Deep teal\nValue: #0f766e\nUser's note: Accent");
    expect(
      referenceFromRow({
        ...empty,
        type: "color",
        colorGradient: { from: "#000000", to: "#ffffff", angle: 90 },
      }),
    ).toEqual({
      kind: "color",
      title: "Color",
      text: "Name: Color\nGradient: linear at 90°, #000000 to #ffffff",
    });
  });

  it("skips rows without their type's data", () => {
    expect(referenceFromRow({ ...empty, type: "link" })).toBeNull();
    expect(referenceFromRow({ ...empty, type: "image" })).toBeNull();
    expect(referenceFromRow({ ...empty, type: "video" })).toBeNull();
  });
});

const variant = (contentType: string, sizeBytes = 100_000) => ({
  objectKey: `key-${contentType}-${sizeBytes}`,
  width: 960,
  height: 640,
  contentType,
  sizeBytes,
});

const imageRow: MentionRow = {
  ...empty,
  id: 7,
  type: "image",
  title: "Moodboard",
  imageWidth: 3000,
  imageHeight: 2000,
  imageAlt: "Teal chairs",
  imageColors: ["#0f766e", "#f5f5f4"],
  imageVariants: { display: variant("image/webp") },
};

describe("images", () => {
  it("describes an image from its stored details", () => {
    expect(referenceFromRow(imageRow)).toEqual({
      kind: "image",
      title: "Moodboard",
      text: [
        "Title: Moodboard",
        "Alt text: Teal chairs",
        "Size: 3000×2000",
        "Dominant colors: #0f766e, #f5f5f4",
      ].join("\n"),
    });
  });

  it("picks the display variant, skipping formats and sizes the model can't take", () => {
    expect(
      imageVariantForModel({
        display: variant("image/avif"),
        preview: variant("image/jpeg"),
      })?.contentType,
    ).toBe("image/jpeg");
    expect(
      imageVariantForModel({ original: variant("image/png", 50_000_000) }),
    ).toBeNull();
    expect(imageVariantForModel(null)).toBeNull();
  });

  it("attaches at most two images and falls back to text when a fetch fails", async () => {
    const rows = [1, 2, 3].map((id) => ({ ...imageRow, id }));
    const mentioned = rows.map((row) => ({
      row,
      reference: referenceFromRow(row)!,
    }));
    let calls = 0;
    const references = await attachImages(mentioned, async () => {
      calls += 1;
      if (calls === 1) throw new Error("S3 down");
      return new Uint8Array([1, 2, 3]);
    });

    expect(calls).toBe(2);
    expect(references.map((reference) => reference.image)).toEqual([
      undefined,
      { mimeType: "image/webp", data: "AQID" },
      undefined,
    ]);
  });

  it("puts attached images after the text, labeled by reference", () => {
    const message = userMessage("Describe R1.", [
      {
        id: "R1",
        title: "Moodboard",
        image: { mimeType: "image/webp", data: "AQID" },
      },
      { id: "R2", title: "Notes" },
    ]);
    expect(message.content).toEqual([
      { type: "text", text: "Describe R1." },
      { type: "text", text: 'Image R1 ("Moodboard"):' },
      { type: "image_url", image_url: "data:image/webp;base64,AQID" },
    ]);
    expect(userMessage("Plain.", [{ id: "R1", title: "x" }]).content).toBe(
      "Plain.",
    );
  });
});
