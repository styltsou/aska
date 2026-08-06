import { describe, expect, it } from "vitest";

import { readUploadImageDimensions } from "./upload-image-dimensions";

describe("readUploadImageDimensions", () => {
  it("uses JPEG header dimensions without decoding image pixels", async () => {
    const image = jpegFile({ width: 2400, height: 1600, orientation: 1 });

    await expect(readUploadImageDimensions(image)).resolves.toEqual({
      width: 2400,
      height: 1600,
    });
  });

  it("swaps dimensions for a JPEG rotated by EXIF orientation", async () => {
    const image = jpegFile({ width: 2400, height: 1600, orientation: 6 });

    await expect(readUploadImageDimensions(image)).resolves.toEqual({
      width: 1600,
      height: 2400,
    });
  });
});

function jpegFile({
  width,
  height,
  orientation,
}: {
  width: number;
  height: number;
  orientation: number;
}) {
  return new File(
    [
      new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xe1,
        0x00,
        0x23,
        0x45,
        0x78,
        0x69,
        0x66,
        0x00,
        0x00,
        0x4d,
        0x4d,
        0x00,
        0x2a,
        0x00,
        0x00,
        0x00,
        0x08,
        0x00,
        0x01,
        0x01,
        0x12,
        0x00,
        0x03,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        orientation,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0xff,
        0xc0,
        0x00,
        0x08,
        0x08,
        height >> 8,
        height & 0xff,
        width >> 8,
        width & 0xff,
        0x00,
      ]),
    ],
    "photo.jpg",
    { type: "image/jpeg" },
  );
}
