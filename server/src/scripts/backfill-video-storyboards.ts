import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Pool } from "@neondatabase/serverless";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Resource } from "sst";

import { videoAssets } from "@/db/schema";

// CI typechecks without generated SST resource declarations. The shell still
// supplies these linked resources at runtime.
const resources = Resource as unknown as {
  DatabaseUrl: { value: string };
  Assets: { name: string };
  VideoProcessingQueue: { url: string };
};
const databaseUrl = resources.DatabaseUrl.value;
if (!databaseUrl) throw new Error("The linked DatabaseUrl secret is empty");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const db = drizzle({ client: pool });

async function missingOriginalKeys(): Promise<string[]> {
  const rows = await db
    .select({ original: videoAssets.original })
    .from(videoAssets)
    .where(
      and(
        eq(videoAssets.processingStatus, "completed"),
        isNotNull(videoAssets.original),
        isNull(videoAssets.storyboard),
      ),
    );
  return rows.flatMap((row) =>
    row.original?.objectKey ? [row.original.objectKey] : [],
  );
}

try {
  const originalKeys = await missingOriginalKeys();
  if (!process.argv.includes("--enqueue")) {
    console.info(
      `Found ${originalKeys.length} completed videos without seek previews. Run with --enqueue to queue backfill jobs.`,
    );
  } else {
    const bucket = resources.Assets.name;
    const queueUrl = resources.VideoProcessingQueue.url;
    if (!bucket || !queueUrl)
      throw new Error("Run this backfill inside the deployed SST environment");
    const client = new SQSClient({
      region: process.env.AWS_REGION ?? "eu-central-1",
    });
    let queued = 0;
    for (const objectKey of originalKeys) {
      await client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            kind: "storyboard-video",
            bucket,
            objectKey,
          }),
        }),
      );
      queued += 1;
    }
    console.info(`Queued ${queued} video storyboard backfill jobs.`);
    if (process.argv.includes("--wait")) {
      const deadline = Date.now() + 20 * 60_000;
      let remaining = originalKeys.length;
      while (remaining > 0) {
        if (Date.now() >= deadline)
          throw new Error(
            `${remaining} video storyboards remain after 20 minutes`,
          );
        await new Promise((resolve) => setTimeout(resolve, 15_000));
        const nextRemaining = (await missingOriginalKeys()).length;
        if (nextRemaining !== remaining)
          console.info(`${nextRemaining} video storyboards remaining.`);
        remaining = nextRemaining;
      }
      console.info("Video storyboard backfill complete.");
    }
  }
} finally {
  await pool.end();
}
