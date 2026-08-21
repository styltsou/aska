import sharp from "sharp";

/**
 * Image decoding and derivative generation for one queued source image.
 *
 * Expensive independent work is deliberately run in parallel so a queue
 * consumer spends as little wall time as possible per source object.
 */

const MAX_PIXELS = 40_000_000;
const MASTER_MAX_WIDTH = 2_400;

export const VARIANT_WIDTHS = { display: 960, preview: 320 } as const;

export type ImageRenditionProfile = "upload-v1" | "link-preview-v1" | "icon-v1";

/** A generated, display-ready derivative that will be written to S3. */
export type ProcessedVariant = {
  role: "master" | "display" | "preview";
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
  sizeBytes: number;
  blurDataURL: string | null;
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
  profile: ImageRenditionProfile = "upload-v1",
): Promise<ProcessedImageVariants> {
  if (
    profile !== "upload-v1" &&
    profile !== "link-preview-v1" &&
    profile !== "icon-v1"
  )
    throw terminal("unsupported_processing_profile");
  const metadata = await sharp(buffer, {
    limitInputPixels: MAX_PIXELS,
    animated: false,
  }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format)
    throw terminal("invalid_image");
  if (
    metadata.width * metadata.height > MAX_PIXELS ||
    (metadata.pages ?? 1) > 1
  )
    throw terminal("unsupported_image_dimensions");

  if (profile === "icon-v1") {
    const bytes = await sharp(buffer, {
      limitInputPixels: MAX_PIXELS,
      animated: false,
    })
      .resize(64, 64, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const iconMetadata = await sharp(bytes).metadata();
    return {
      width: iconMetadata.width!,
      height: iconMetadata.height!,
      format: metadata.format,
      sizeBytes: buffer.byteLength,
      blurDataURL: null,
      variants: [
        {
          role: "master",
          width: iconMetadata.width!,
          height: iconMetadata.height!,
          contentType: "image/webp",
          sizeBytes: bytes.length,
          bytes,
        },
      ],
    };
  }

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

  const variants: ProcessedVariant[] = [display, preview];
  if (profile === "link-preview-v1") {
    const bytes = await sharp(buffer, {
      limitInputPixels: MAX_PIXELS,
      animated: false,
    })
      .resize(MASTER_MAX_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
    const masterMetadata = await sharp(bytes).metadata();
    variants.unshift({
      role: "master",
      width: masterMetadata.width!,
      height: masterMetadata.height!,
      contentType: "image/webp",
      sizeBytes: bytes.length,
      bytes,
    });
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    sizeBytes: buffer.byteLength,
    blurDataURL,
    variants,
  };
}

function terminal(message: string): Error & { retryable: false } {
  return Object.assign(new Error(message), { retryable: false as const });
}

/** Encodes binary data as base64 without relying on Node.js Buffer APIs. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index++)
    binary += String.fromCharCode(bytes[index]!);

  return btoa(binary);
}
