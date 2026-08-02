import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/config";
import { AppError, ErrorCode } from "@/lib/errors";

export type PresignedPutUrl = {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

export type PresignedGetUrl = {
  key: string;
  url: string;
  expiresAt: Date;
};

export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export interface IObjectStorageService {
  bucket: string;
  createPresignedPutUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<PresignedPutUrl>;
  createPresignedGetUrl(
    key: string,
    expiresInSeconds?: number,
  ): Promise<PresignedGetUrl>;
  createPresignedGetUrls(
    keys: Iterable<string>,
    expiresInSeconds?: number,
  ): Promise<Map<string, PresignedGetUrl>>;
  putObject(input: PutObjectInput): Promise<void>;
  getObjectBytes(key: string): Promise<Uint8Array>;
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
}

export class ObjectStorageService implements IObjectStorageService {
  private client: S3Client | null = null;

  get bucket(): string {
    return this.getRequiredConfig().bucket;
  }

  async createPresignedPutUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<PresignedPutUrl> {
    const { bucket } = this.getRequiredConfig();
    const expiresInSeconds =
      input.expiresInSeconds ?? env.S3_PRESIGNED_UPLOAD_EXPIRES_SECONDS;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
    });

    const url = await getSignedUrl(this.getClient(), command, {
      expiresIn: expiresInSeconds,
    });

    return {
      url,
      headers: {
        "Content-Type": input.contentType,
      },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async createPresignedGetUrl(
    key: string,
    expiresInSeconds = env.S3_PRESIGNED_READ_EXPIRES_SECONDS,
  ): Promise<PresignedGetUrl> {
    const mediaUrl = this.createMediaUrl(key);
    if (mediaUrl) {
      return {
        key,
        url: mediaUrl,
        // The URL itself is immutable. Access is limited by the CloudFront
        // signed cookie, whose lifetime is deliberately separate from a URL.
        expiresAt: new Date(
          Date.now() + env.CLOUDFRONT_SIGNED_COOKIE_EXPIRES_SECONDS * 1000,
        ),
      };
    }

    const { bucket } = this.getRequiredConfig();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.getClient(), command, {
      expiresIn: expiresInSeconds,
    });

    return {
      key,
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async createPresignedGetUrls(
    keys: Iterable<string>,
    expiresInSeconds = env.S3_PRESIGNED_READ_EXPIRES_SECONDS,
  ): Promise<Map<string, PresignedGetUrl>> {
    const uniqueKeys = [...new Set(keys)];
    const signed = await Promise.all(
      uniqueKeys.map((key) =>
        this.createPresignedGetUrl(key, expiresInSeconds),
      ),
    );

    return new Map(signed.map((item) => [item.key, item]));
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const { bucket } = this.getRequiredConfig();
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getObjectBytes(key: string): Promise<Uint8Array> {
    const { bucket } = this.getRequiredConfig();
    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const body = response.Body;
    if (!body) {
      throw new AppError(ErrorCode.NOT_FOUND, "Stored object is empty");
    }

    return body.transformToByteArray();
  }

  async deleteObject(key: string): Promise<void> {
    const { bucket } = this.getRequiredConfig();
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const { bucket } = this.getRequiredConfig();
    await this.getClient().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      }),
    );
  }

  private getClient(): S3Client {
    const config = this.getRequiredConfig();
    this.client ??= new S3Client({
      region: config.region,
      ...(config.endpoint
        ? { endpoint: config.endpoint, forcePathStyle: true }
        : {}),
      // Lambda obtains production credentials from its execution role. Local
      // development can provide an explicit key pair or use an AWS profile.
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });

    return this.client;
  }

  private createMediaUrl(key: string): string | undefined {
    // Only generated, immutable renditions belong on the media distribution.
    // Originals remain in ingest/ and continue to require an intentional
    // presigned S3 read for download/viewer flows.
    if (!env.MEDIA_BASE_URL || !key.startsWith("assets/")) return undefined;

    return new URL(key, `${env.MEDIA_BASE_URL}/`).toString();
  }

  private getRequiredConfig(): {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  } {
    if (!env.S3_BUCKET) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Object storage is not configured. Missing: S3_BUCKET",
      );
    }

    return {
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      ...(env.S3_ACCESS_KEY_ID ? { accessKeyId: env.S3_ACCESS_KEY_ID } : {}),
      ...(env.S3_SECRET_ACCESS_KEY
        ? { secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : {}),
    };
  }
}
