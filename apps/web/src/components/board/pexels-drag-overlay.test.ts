import { describe, expect, it, vi } from "vitest";
import type { PexelsPhoto } from "@/api/pexels";
import { getCanvasDropFanOffset } from "@/components/canvas/canvas-drop-stack";
import {
  getPexelsDropTopLeft,
  makePexelsOverlayStackStyles,
  waitForPexelsCanvasDrop,
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
  it("uses the painted overlay bounds for the board handoff", () => {
    expect(
      getPexelsDropTopLeft({
        initialPointer: { x: 150, y: 200 },
        currentPointer: { x: 700, y: 500 },
        sourceBounds: { left: 100, top: 100, width: 200, height: 400 },
        overlayBounds: { left: 673.5, top: 452.25 },
        photo,
        zoom: 0.5,
      }),
    ).toEqual({ x: 673.5, y: 452.25 });
  });

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
    const fan = getCanvasDropFanOffset(1, 1);
    const styles = makePexelsOverlayStackStyles([photo, landscape], width);
    expect(styles.get(photo.id)).toMatchObject({
      translateX: 0,
      translateY: 0,
      scale: 1,
      stackOrder: 2,
    });
    expect(styles.get(landscape.id)).toMatchObject({
      rotation: fan.rotation,
      scale: 1,
      stackOrder: 1,
    });
    expect(styles.get(landscape.id)!.translateX).toBeCloseTo(
      (fan.x * width) / 280,
    );
    expect(styles.get(landscape.id)!.translateY).toBeCloseTo(
      (fan.y * width) / 280,
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

  it("releases the drag overlay after the matching canvas image has painted", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      const image = {
        getAttribute: () => photo.urls.small,
        complete: true,
        naturalWidth: 200,
        style: { opacity: "1" },
      } as unknown as HTMLImageElement;
      const card = {
        dataset: { pexelsDropClientId: "drop-1" },
        querySelectorAll: () => [image],
      } as unknown as HTMLElement;
      const dropZone = {
        isConnected: true,
        querySelectorAll: () => [card],
      } as unknown as HTMLElement;

      const handoff = waitForPexelsCanvasDrop(dropZone, photo, "drop-1");
      let released = false;
      void handoff.then(() => {
        released = true;
      });

      frames.shift()?.(0);
      await Promise.resolve();
      expect(released).toBe(false);

      frames.shift()?.(16);
      await handoff;
      expect(released).toBe(true);
      expect(frames).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
