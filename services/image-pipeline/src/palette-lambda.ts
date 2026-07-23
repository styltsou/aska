import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { sendCallback } from "./pipeline-callback";
import { processImagePalette } from "./processor";
import { createSqsHandler, type SourceImage } from "./sqs-handler";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const client = new S3Client({});

async function processPalette(source: SourceImage) {
  if ((source.size ?? 0) > MAX_SOURCE_BYTES)
    throw new Error("Source image exceeds the 20 MiB processing limit");

  const original = await client.send(
    new GetObjectCommand({ Bucket: source.bucket, Key: source.objectKey }),
  );
  if (!original.Body) throw new Error("Original object no longer exists");

  const bytes = await original.Body.transformToByteArray();
  const palette = await processImagePalette(bytes);
  await sendCallback({
    event: "image.palette.completed",
    originalObjectKey: source.objectKey,
    originalEtag: source.originalEtag,
    ...palette,
  });
  console.log(
    JSON.stringify({
      event: "image_palette.completed",
      objectKey: source.objectKey,
      colors: palette.palette.length,
    }),
  );
}

export const handler = createSqsHandler({
  pipeline: "palette",
  process: processPalette,
  reportTerminalFailure: (source, error) =>
    sendCallback({
      event: "image.palette.failed",
      originalObjectKey: source.objectKey,
      originalEtag: source.originalEtag,
      error,
    }),
});
