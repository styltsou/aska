import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { sendCallback, storageIdFromOriginalKey } from "./pipeline-callback";
import { processImageVariants } from "./processor";
import { createSqsHandler, type SourceImage } from "./sqs-handler";

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
  const storageId = storageIdFromOriginalKey(source.objectKey);
  const variants = await Promise.all(
    result.variants.map(async (variant) => {
      const objectKey = `assets/${storageId}/${variant.role}.webp`;
      await client.send(
        new PutObjectCommand({
          Bucket: source.bucket,
          Key: objectKey,
          Body: variant.bytes,
          ContentType: variant.contentType,
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
  console.log(
    JSON.stringify({
      event: "image_variants.completed",
      objectKey: source.objectKey,
      variants: variants.length,
    }),
  );
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
