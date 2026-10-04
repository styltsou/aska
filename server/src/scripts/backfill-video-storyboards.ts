import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Pool } from "@neondatabase/serverless";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Resource } from "sst";

import { videoAssets } from "@/db/schema";

const databaseUrl = Resource.DatabaseUrl.value;
if (!databaseUrl) throw new Error("The linked DatabaseUrl secret is empty");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const db = drizzle({ client: pool });

try {
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
  const originalKeys = rows.flatMap((row) =>
    row.original?.objectKey ? [row.original.objectKey] : [],
  );

  if (!process.argv.includes("--enqueue")) {
    console.info(
      `Found ${originalKeys.length} completed videos without seek previews. Run with --enqueue to queue backfill jobs.`,
    );
  } else {
    const bucket = Resource.Assets.name;
    // The generated SST types predate this queue; the deployed stage links it.
    const queueUrl = (
      Resource as unknown as { VideoProcessingQueue: { url: string } }
    ).VideoProcessingQueue.url;
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
  }
} finally {
  await pool.end();
}
