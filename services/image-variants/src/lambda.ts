import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  initializeObservability,
  log,
} from "../../image-shared/src/observability";
import {
  sendCallback,
  imageIdentityFromOriginalKey,
} from "../../image-shared/src/pipeline-callback";
import { processImageVariants } from "./processor";
import {
  createSqsHandler,
  type SourceImage,
} from "../../image-shared/src/sqs-handler";

initializeObservability("image-variants");

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const client = new S3Client({});

async function processVariants(source: SourceImage) {
  if ((source.size ?? 0) > MAX_SOURCE_BYTES)
    throw new Error("Source image exceeds the 20 MiB processing limit");

  await sendCallback({
    event: "image.processing.started",
    originalObjectKey: source.objectKey,
    originalEtag: source.originalEtag,
  });
  const original = await client.send(
    new GetObjectCommand({ Bucket: source.bucket, Key: source.objectKey }),
  );
  if (!original.Body) throw new Error("Original object no longer exists");

  const bytes = await original.Body.transformToByteArray();
  const result = await processImageVariants(bytes);
  const { workspaceId, storageId } = imageIdentityFromOriginalKey(
    source.objectKey,
  );
  const variants = await Promise.all(
    result.variants.map(async (variant) => {
      const objectKey = `${workspaceId}/${storageId}/${variant.role}.webp`;
      await client.send(
        new PutObjectCommand({
          Bucket: source.bucket,
          Key: objectKey,
          Body: variant.bytes,
          ContentType: variant.contentType,
          // storageId is unique per upload, so rendition paths are immutable.
          // CloudFront and browsers can safely retain them for a year.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return { ...variant, objectKey };
    }),
  );

  await sendCallback({
    event: "image.variants.completed",
    originalObjectKey: source.objectKey,
    originalEtag: source.originalEtag,
    width: result.width,
    height: result.height,
    format: result.format,
    blurDataURL: result.blurDataURL,
    variants,
  });
  log("info", "image variants completed", {
    event: "image_variants.completed",
    objectKey: source.objectKey,
    variants: variants.length,
  });
}

export const handler = createSqsHandler({
  pipeline: "variants",
  process: processVariants,
  reportTerminalFailure: (source, error) =>
    sendCallback({
      event: "image.variants.failed",
      originalObjectKey: source.objectKey,
      originalEtag: source.originalEtag,
      error,
    }),
});
