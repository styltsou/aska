import sharp from "sharp";

import { processImageVariants } from "../../image-variants/src/processor";

const MAX_PIXELS = 40_000_000;
const MASTER_MAX_WIDTH = 2_400;

export type ResourceVariant = {
  role: "master" | "display" | "preview";
  width: number;
  height: number;
  contentType: "image/webp";
  sizeBytes: number;
  bytes: Uint8Array;
};

export async function processResourceImage(
  bytes: Uint8Array,
  profile: string,
): Promise<{
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  blurDataURL: string | null;
  variants: ResourceVariant[];
}> {
  const metadata = await sharp(bytes, {
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
    const iconBytes = await sharp(bytes, {
      limitInputPixels: MAX_PIXELS,
      animated: false,
    })
      .resize(64, 64, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const iconMetadata = await sharp(iconBytes).metadata();
    const variant: ResourceVariant = {
      role: "master",
      width: iconMetadata.width!,
      height: iconMetadata.height!,
      contentType: "image/webp",
      sizeBytes: iconBytes.length,
      bytes: iconBytes,
    };
    return {
      width: variant.width,
      height: variant.height,
      format: metadata.format,
      sizeBytes: bytes.byteLength,
      blurDataURL: null,
      variants: [variant],
    };
  }

  if (profile !== "link-preview-v1")
    throw terminal("unsupported_processing_profile");
  const processed = await processImageVariants(bytes);
  const masterBytes = await sharp(bytes, {
    limitInputPixels: MAX_PIXELS,
    animated: false,
  })
    .resize(MASTER_MAX_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
  const masterMetadata = await sharp(masterBytes).metadata();
  const master: ResourceVariant = {
    role: "master",
    width: masterMetadata.width!,
    height: masterMetadata.height!,
    contentType: "image/webp",
    sizeBytes: masterBytes.length,
    bytes: masterBytes,
  };
  return {
    width: processed.width,
    height: processed.height,
    format: processed.format,
    sizeBytes: bytes.byteLength,
    blurDataURL: processed.blurDataURL,
    variants: [master, ...processed.variants],
  };
}

function terminal(message: string): Error & { retryable: false } {
  return Object.assign(new Error(message), { retryable: false as const });
}
