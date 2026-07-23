import { createHmac } from "node:crypto";

type PipelineVariant = {
  role: "display" | "preview";
  objectKey: string;
  width: number;
  height: number;
  contentType: "image/webp";
  sizeBytes: number;
};

export type PipelineCallback =
  | {
      event: "image.processing.started";
      originalObjectKey: string;
      originalEtag: string;
    }
  | {
      event: "image.variants.completed";
      originalObjectKey: string;
      originalEtag: string;
      width: number;
      height: number;
      format: string;
      blurDataURL: string;
      variants: PipelineVariant[];
    }
  | {
      event: "image.palette.completed";
      originalObjectKey: string;
      originalEtag: string;
      extractionVersion: number;
      palette: unknown[];
    }
  | {
      event: "image.variants.failed" | "image.palette.failed";
      originalObjectKey: string;
      originalEtag: string;
      error: string;
    };

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

/** Sends an authenticated, idempotent processing result to the API. */
export async function sendCallback(payload: PipelineCallback) {
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = createHmac(
    "sha256",
    required("IMAGE_PIPELINE_CALLBACK_SECRET"),
  )
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const response = await fetch(
    new URL(
      "/api/v1/internal/image-pipeline/callback",
      required("PIPELINE_API_BASE_URL"),
    ),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aska-timestamp": timestamp,
        "x-aska-signature": signature,
      },
      body,
    },
  );
  if (!response.ok)
    throw new Error(`Pipeline callback failed with status ${response.status}`);
}

export function storageIdFromOriginalKey(objectKey: string): string {
  const match = /^ingest\/([^/]+)\/original(?:\.[a-z0-9]+)?$/i.exec(objectKey);
  if (!match) throw new Error("Invalid ingest object key");
  return match[1]!;
}
