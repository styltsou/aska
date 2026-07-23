import sharp from "sharp";


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

/** Encodes binary data as base64 without relying on Node.js Buffer APIs. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index++)
    binary += String.fromCharCode(bytes[index]!);

  return btoa(binary);
}
