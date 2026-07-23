import sharp from "sharp";

import {
  extractPaletteFromSamples,
  isAccentSample,
  PALETTE_EXTRACTION_VERSION,
  type ImagePaletteColor,
} from "./palette-extraction";
import { rgbToOklab, type Oklab } from "./color";

/**
 * Image decoding and derivative generation for one queued source image.
 *
 * Expensive independent work is deliberately run in parallel so a queue
 * consumer spends as little wall time as possible per source object.
 */

export const VARIANT_WIDTHS = { display: 960, preview: 320 } as const;

/** A generated, display-ready derivative that will be written to S3. */
export type ProcessedVariant = {
  role: "display" | "preview";
  width: number;
  height: number;
  contentType: "image/webp";
  sizeBytes: number;
  bytes: Uint8Array;
};

/** All metadata and derivatives produced from one original image. */
export type ProcessedImageVariants = {
  width: number;
  height: number;
  format: string;
  blurDataURL: string;
  variants: ProcessedVariant[];
};

/** Generates one WebP variant without enlarging a source image. */
async function makeWidthVariant(
  buffer: Uint8Array,
  role: ProcessedVariant["role"],
  targetWidth: number,
  sourceWidth: number,
  sourceHeight: number,
): Promise<ProcessedVariant> {
  const width = Math.min(sourceWidth, targetWidth);
  const bytes = await sharp(buffer)
    .resize(targetWidth, undefined, { withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return {
    role,
    width,
    height: Math.max(1, Math.round((sourceHeight * width) / sourceWidth)),
    contentType: "image/webp",
    sizeBytes: bytes.length,
    bytes,
  };
}

/** Generates the small, low-quality WebP data URL used as a progressive-image placeholder. */
async function makeBlurDataURL(buffer: Uint8Array): Promise<string> {
  const tiny = await sharp(buffer)
    .resize(8, undefined, { withoutEnlargement: true })
    .webp({ quality: 20 })
    .toBuffer();
  return `data:image/webp;base64,${uint8ArrayToBase64(tiny)}`;
}

/**
 * Performs the two sampling passes required by palette extraction.
 *
 * The coverage pass preserves source proportions, while nearest-neighbour
 * sampling protects small saturated image details from interpolation.
 */
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

/** Converts raw RGBA pixels into bounded Oklab samples, optionally retaining only accent candidates. */
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

/** Evenly downsamples an ordered sample set without introducing random variation. */
function evenlySample<T>(samples: T[], limit: number): T[] {
  if (samples.length <= limit) return samples;
  const step = samples.length / limit;

  return Array.from(
    { length: limit },
    (_, index) => samples[Math.floor(index * step)]!,
  );
}

/**
 * Decodes an original image and produces its metadata, progressive placeholder,
 * and display variants.
 */
export async function processImageVariants(
  buffer: Uint8Array,
): Promise<ProcessedImageVariants> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height)
    throw new Error("Could not read image dimensions");

  const [display, preview, blurDataURL] = await Promise.all([
    makeWidthVariant(
      buffer,
      "display",
      VARIANT_WIDTHS.display,
      metadata.width,
      metadata.height,
    ),
    makeWidthVariant(
      buffer,
      "preview",
      VARIANT_WIDTHS.preview,
      metadata.width,
      metadata.height,
    ),
    makeBlurDataURL(buffer),
  ]);

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format ?? "unknown",
    blurDataURL,
    variants: [display, preview],
  };
}

/** Extracts colour metadata independently of rendition generation. */
export async function processImagePalette(buffer: Uint8Array): Promise<{
  extractionVersion: number;
  palette: ImagePaletteColor[];
}> {
  return {
    extractionVersion: PALETTE_EXTRACTION_VERSION,
    palette: await extractPalette(buffer),
  };
}

/** Encodes binary data as base64 without relying on Node.js Buffer APIs. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index++)
    binary += String.fromCharCode(bytes[index]!);

  return btoa(binary);
}
