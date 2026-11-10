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

  it("reads PNG header dimensions", async () => {
    const image = pngFile({ width: 1200, height: 800 });

    await expect(readUploadImageDimensions(image)).resolves.toEqual({
      width: 1200,
      height: 800,
    });
  });
});

function pngFile({ width, height }: { width: number; height: number }) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return new File([bytes], "photo.png", { type: "image/png" });
}

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
