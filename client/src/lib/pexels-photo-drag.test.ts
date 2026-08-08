import { describe, expect, it } from "vitest";

import type { PexelsPhoto } from "@/api/pexels";
import {
  PEXELS_PHOTO_DRAG_TYPE,
  getPexelsPhotoDragData,
  hasPexelsPhotoDrag,
  setPexelsPhotoDragData,
} from "./pexels-photo-drag";

const photo: PexelsPhoto = {
  id: "2014422",
  width: 3024,
  height: 3024,
  alt: "Brown rocks during golden hour",
  urls: {
    thumb: "https://images.pexels.com/thumb.jpeg",
    small: "https://images.pexels.com/small.jpeg",
    regular: "https://images.pexels.com/regular.jpeg",
    original: "https://images.pexels.com/original.jpeg",
  },
  url: "https://www.pexels.com/photo/brown-rocks-2014422/",
  photographer: {
    name: "Joey Farina",
    profileUrl: "https://www.pexels.com/@joey",
  },
};

describe("Pexels photo drag payload", () => {
  it("serializes and restores multiple photos", () => {
    const values = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? "",
    };

    setPexelsPhotoDragData(dataTransfer, [photo, { ...photo, id: "2014423" }]);

    expect(getPexelsPhotoDragData(dataTransfer)).toEqual([
      photo,
      { ...photo, id: "2014423" },
    ]);
    expect(values.get("text/plain")).toContain(photo.url);
  });

  it("ignores malformed or incomplete data", () => {
    expect(
      getPexelsPhotoDragData({
        getData: () => JSON.stringify([{ id: photo.id }]),
      }),
    ).toEqual([]);
    expect(getPexelsPhotoDragData({ getData: () => "not-json" })).toEqual([]);
  });

  it("recognizes only the internal Pexels drag type", () => {
    expect(hasPexelsPhotoDrag({ types: [PEXELS_PHOTO_DRAG_TYPE] })).toBe(true);
    expect(hasPexelsPhotoDrag({ types: ["text/plain"] })).toBe(false);
  });
});
