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
  private presignedReadUrls = new Map<string, PresignedGetUrl>();

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
      input.expiresInSeconds ?? env.R2_PRESIGNED_UPLOAD_EXPIRES_SECONDS;
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
    expiresInSeconds = env.R2_PRESIGNED_READ_EXPIRES_SECONDS,
  ): Promise<PresignedGetUrl> {
    const cacheKey = `${expiresInSeconds}:${key}`;
    const cached = this.presignedReadUrls.get(cacheKey);
    if (cached && cached.expiresAt.getTime() > Date.now() + 30_000) {
      this.presignedReadUrls.delete(cacheKey);
      this.presignedReadUrls.set(cacheKey, cached);
      return cached;
    }

    const { bucket } = this.getRequiredConfig();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.getClient(), command, {
      expiresIn: expiresInSeconds,
    });

    const signed = {
      key,
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
    this.cachePresignedReadUrl(cacheKey, signed);
    return signed;
  }

  async createPresignedGetUrls(
    keys: Iterable<string>,
    expiresInSeconds = env.R2_PRESIGNED_READ_EXPIRES_SECONDS,
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
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    return this.client;
  }

  private cachePresignedReadUrl(cacheKey: string, signed: PresignedGetUrl) {
    this.presignedReadUrls.set(cacheKey, signed);

    while (this.presignedReadUrls.size > 500) {
      const oldestKey = this.presignedReadUrls.keys().next().value;
      if (!oldestKey) return;
      this.presignedReadUrls.delete(oldestKey);
    }
  }

  private getRequiredConfig(): {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  } {
    const missing = [
      ["R2_ACCOUNT_ID", env.R2_ACCOUNT_ID],
      ["R2_ACCESS_KEY_ID", env.R2_ACCESS_KEY_ID],
      ["R2_SECRET_ACCESS_KEY", env.R2_SECRET_ACCESS_KEY],
      ["R2_BUCKET", env.R2_BUCKET],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Object storage is not configured. Missing: ${missing.join(", ")}`,
      );
    }

    return {
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucket: env.R2_BUCKET!,
    };
  }
}
