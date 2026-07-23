import sharp from "sharp";

import {
  extractPaletteFromSamples,
  isAccentSample,
  PALETTE_EXTRACTION_VERSION,
  type ImagePaletteColor,
} from "./palette-extraction";
import { rgbToOklab, type Oklab } from "./color";

async function extractPalette(
  buffer: Uint8Array,
): Promise<ImagePaletteColor[]> {
  const [coverage, accent] = await Promise.all([
    sharp(buffer)
      .resize(192, 192, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer(),
    sharp(buffer)
      .resize(512, 512, { fit: "inside", kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ]);

  return extractPaletteFromSamples(
    readOklabSamples(coverage, false, 18_000),
    readOklabSamples(accent, true, 24_000),
    readOklabSamples(accent, false, 24_000),
  );
}

function readOklabSamples(
  data: Uint8Array,
  accentsOnly: boolean,
  maxSamples: number,
): Oklab[] {
  const samples: Oklab[] = [];
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3]! < 128) continue;
    const sample = rgbToOklab({
      r: data[index]!,
      g: data[index + 1]!,
      b: data[index + 2]!,
    });
    if (!accentsOnly || isAccentSample(sample)) samples.push(sample);
  }
  return evenlySample(samples, maxSamples);
}

function evenlySample<T>(samples: T[], limit: number): T[] {
  if (samples.length <= limit) return samples;
  const step = samples.length / limit;
  return Array.from(
    { length: limit },
    (_, index) => samples[Math.floor(index * step)]!,
  );
}

/** Extracts search-oriented colour metadata from an original image. */
export async function processImagePalette(buffer: Uint8Array): Promise<{
  extractionVersion: number;
  palette: ImagePaletteColor[];
}> {
  return {
    extractionVersion: PALETTE_EXTRACTION_VERSION,
    palette: await extractPalette(buffer),
  };
}
