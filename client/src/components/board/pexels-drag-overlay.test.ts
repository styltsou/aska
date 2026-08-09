import { describe, expect, it } from "vitest";
import type { PexelsPhoto } from "@/api/pexels";
import { makeCanvasDropStackStyles } from "@/components/canvas/canvas-drop-stack";
import {
  getPexelsDropTopLeft,
  makePexelsOverlayStackStyles,
} from "./pexels-drag-overlay";

const photo = {
  id: "photo-1",
  width: 400,
  height: 600,
  alt: "Portrait",
  urls: {
    thumb: "thumb",
    small: "small",
    regular: "regular",
    original: "original",
  },
  url: "photo-url",
  photographer: { name: "Photographer", profileUrl: "profile-url" },
} satisfies PexelsPhoto;

describe("Pexels drag overlay placement", () => {
  it("preserves the pointer's relative grab point at the canvas zoom", () => {
    expect(
      getPexelsDropTopLeft({
        initialPointer: { x: 150, y: 200 },
        currentPointer: { x: 700, y: 500 },
        sourceBounds: { left: 100, top: 100, width: 200, height: 400 },
        photo,
        zoom: 0.5,
      }),
    ).toEqual({ x: 665, y: 447.5 });
  });

  it("uses the card center if source geometry is unavailable", () => {
    expect(
      getPexelsDropTopLeft({
        initialPointer: { x: 0, y: 0 },
        currentPointer: { x: 500, y: 500 },
        photo,
        zoom: 1,
      }),
    ).toEqual({ x: 360, y: 290 });
  });

  it("uses the canvas multi-drag stack for every selected photo", () => {
    const landscape = {
      ...photo,
      id: "photo-2",
      width: 600,
      height: 300,
    };
    const width = 200;
    const expected = makeCanvasDropStackStyles(
      photo.id,
      new Map([
        [photo.id, { x: 0, y: 0, height: 300 }],
        [landscape.id, { x: 0, y: 0, height: 100 }],
      ]),
    );

    expect(makePexelsOverlayStackStyles([photo, landscape], width)).toEqual(
      expected,
    );
  });

  it("does not compress a single-photo drag", () => {
    expect(makePexelsOverlayStackStyles([photo], 200).get(photo.id)).toEqual({
      translateX: 0,
      translateY: 0,
      rotation: 0,
      scale: 1,
      stackOrder: 1,
      delayMs: 0,
    });
  });
});
