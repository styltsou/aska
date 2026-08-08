import { describe, expect, it } from "vitest";
import type { PexelsPhoto } from "@/api/pexels";
import { toPexelsRemoteImageInput } from "./pexels-import";

describe("Pexels remote image input", () => {
  it("uses API dimensions and the display-sized URL for the optimistic card", () => {
    const photo = {
      id: "photo-1",
      width: 2400,
      height: 1600,
      alt: "Landscape",
      urls: {
        thumb: "thumb",
        small: "small",
        regular: "regular",
        original: "original",
      },
      url: "photo-url",
      photographer: { name: "Photographer", profileUrl: "profile-url" },
    } satisfies PexelsPhoto;

    expect(toPexelsRemoteImageInput(photo).preview).toEqual({
      url: "regular",
      fallbackUrl: "small",
      width: 2400,
      height: 1600,
    });
  });
});
