import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import { env } from "@/config";

export interface ITaskQueueService {
  enqueueResolution(attemptId: number, generation: number): Promise<boolean>;
  enqueueResourceMedia(mediaId: number, generation: number): Promise<boolean>;
}

export class TaskQueueService implements ITaskQueueService {
  private client: SQSClient | undefined;

  enqueueResolution(attemptId: number, generation: number): Promise<boolean> {
    return this.send(env.URL_RESOLUTION_QUEUE_URL, {
      version: 1,
      attemptId,
      generation,
    });
  }

  enqueueResourceMedia(mediaId: number, generation: number): Promise<boolean> {
    return this.send(env.RESOURCE_MEDIA_QUEUE_URL, {
      version: 1,
      mediaId,
      generation,
    });
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
