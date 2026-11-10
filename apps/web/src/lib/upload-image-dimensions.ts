import { imageDimensionsFromStream } from "image-dimensions";

const JPEG_METADATA_BYTES = 256 * 1024;

type ImageDimensions = {
  width: number;
  height: number;
};

/**
 * Reads only the image metadata needed to size an optimistic upload card.
 * Image pixel decoding remains the browser's job when the local preview paints.
 */
export async function readUploadImageDimensions(
  file: File,
): Promise<ImageDimensions> {
  const [dimensions, orientation] = await Promise.all([
    imageDimensionsFromStream(file.stream()),
    readJpegOrientation(file),
  ]);

  if (!dimensions) {
    throw new Error("Unable to read image dimensions");
  }

  const isRotated =
    dimensions.type === "jpeg" &&
    orientation !== undefined &&
    orientation >= 5 &&
    orientation <= 8;

  return isRotated
    ? { width: dimensions.height, height: dimensions.width }
    : { width: dimensions.width, height: dimensions.height };
}

async function readJpegOrientation(file: File): Promise<number | undefined> {
  if (file.type !== "image/jpeg") return undefined;

  const bytes = new Uint8Array(
    await file.slice(0, JPEG_METADATA_BYTES).arrayBuffer(),
  );
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;

    const marker = bytes[offset + 1]!;
    const segmentLength = readUint16(bytes, offset + 2, false);
    if (!segmentLength || offset + 2 + segmentLength > bytes.length) {
      return undefined;
    }

    if (marker === 0xe1) {
      const orientation = readExifOrientation(bytes, offset + 4);
      if (orientation !== undefined) return orientation;
    }

    offset += 2 + segmentLength;
  }

  return undefined;
}

function readExifOrientation(
  bytes: Uint8Array,
  exifOffset: number,
): number | undefined {
  if (
    bytes[exifOffset] !== 0x45 ||
    bytes[exifOffset + 1] !== 0x78 ||
    bytes[exifOffset + 2] !== 0x69 ||
    bytes[exifOffset + 3] !== 0x66 ||
    bytes[exifOffset + 4] !== 0 ||
    bytes[exifOffset + 5] !== 0
  ) {
    return undefined;
  }

  const tiffOffset = exifOffset + 6;
  const byteOrder = readUint16(bytes, tiffOffset, false);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return undefined;

  if (readUint16(bytes, tiffOffset + 2, littleEndian) !== 42) {
    return undefined;
  }

  const ifdOffset = readUint32(bytes, tiffOffset + 4, littleEndian);
  if (ifdOffset === undefined) return undefined;

  const directoryOffset = tiffOffset + ifdOffset;
  const entryCount = readUint16(bytes, directoryOffset, littleEndian);
  if (entryCount === undefined) return undefined;

  for (let index = 0; index < entryCount; index++) {
    const entryOffset = directoryOffset + 2 + index * 12;
    const tag = readUint16(bytes, entryOffset, littleEndian);
    const type = readUint16(bytes, entryOffset + 2, littleEndian);
    const count = readUint32(bytes, entryOffset + 4, littleEndian);
    if (tag === 0x0112 && type === 3 && count === 1) {
      return readUint16(bytes, entryOffset + 8, littleEndian);
    }
  }

  return undefined;
}

function readUint16(
  bytes: Uint8Array,
  offset: number,
  littleEndian: boolean,
): number | undefined {
  if (offset < 0 || offset + 2 > bytes.length) return undefined;

  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint16(offset, littleEndian);
}

function readUint32(
  bytes: Uint8Array,
  offset: number,
  littleEndian: boolean,
): number | undefined {
  if (offset < 0 || offset + 4 > bytes.length) return undefined;

  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(offset, littleEndian);
}
