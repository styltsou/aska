import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import { resourceMediaRenditionJob } from "../../../services/image-shared/src/variant-job";
import { urlResolutionJob } from "../../../services/url-unfurl-shared/src/resolution-job";

import { env } from "@/config";

export interface ITaskQueueService {
  enqueueResolution(attemptId: number, generation: number): Promise<boolean>;
  enqueueResourceMediaRenditions(
    mediaId: number,
    generation: number,
  ): Promise<boolean>;
}

export class TaskQueueService implements ITaskQueueService {
  private client: SQSClient | undefined;

  enqueueResolution(attemptId: number, generation: number): Promise<boolean> {
    return this.send(
      linkedQueueUrl("UrlResolutionQueue", env.URL_RESOLUTION_QUEUE_URL),
      urlResolutionJob(attemptId, generation),
    );
  }

  enqueueResourceMediaRenditions(
    mediaId: number,
    generation: number,
  ): Promise<boolean> {
    return this.send(
      linkedQueueUrl("ImageVariantsQueue", env.IMAGE_VARIANTS_QUEUE_URL),
      resourceMediaRenditionJob(mediaId, generation),
    );
  }

  private async send(
    queueUrl: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (!queueUrl) return false;
    this.client ??= new SQSClient({ region: env.S3_REGION });
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload),
      }),
    );
    return true;
  }
}

type LinkedQueueName = "UrlResolutionQueue" | "ImageVariantsQueue";

function linkedQueueUrl(
  name: LinkedQueueName,
  localFallback: string | undefined,
): string | undefined {
  if (localFallback) return localFallback;
  try {
    return Resource[name].url;
  } catch {
    // Direct package tests and standalone local runs are intentionally allowed
    // without SST links; enqueueing then follows the existing false result.
    return undefined;
  }
}
