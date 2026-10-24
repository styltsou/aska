import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { callPipeline } from "../../image-shared/src/pipeline-client";
import { parseGradientNamingJob } from "./job";
import { generateGradientName, type NameInput } from "./namer";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    let job;
    try {
      job = parseGradientNamingJob(JSON.parse(record.body));
    } catch (error) {
      console.error("Invalid gradient naming job", error);
      continue;
    }
    try {
      const claim = await callPipeline<
        { ignored: true } | ({ ignored: false } & NameInput)
      >("/api/v1/internal/gradient-naming/claim", job);
      if (claim.ignored) continue;
      let title: string;
      try {
        title = await generateGradientName(claim);
      } catch (error) {
        // A free-tier limit or model failure must not turn a saved color into a retry loop.
        console.warn("Gradient naming failed", { assetId: job.assetId, error });
        continue;
      }
      await callPipeline("/api/v1/internal/gradient-naming/result", {
        job,
        title,
      });
    } catch (error) {
      console.error("Gradient naming pipeline failed", {
        assetId: job.assetId,
        error,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
