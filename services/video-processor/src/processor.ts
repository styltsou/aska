import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReadStream } from "node:fs";
import { existsSync } from "node:fs";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { callPipeline } from "../../image-shared/src/pipeline-client";
import {
  safeFetchToFile,
  SafeFetchError,
} from "../../url-unfurl-shared/src/safe-fetch";

const run = promisify(execFile);
const s3 = new S3Client({});
const MAX_BYTES = 250 * 1024 * 1024;
const MIME_TYPES = ["video/mp4", "video/webm"] as const;
type VideoMime = (typeof MIME_TYPES)[number];
const CALLBACK_PATH = "/api/v1/internal/video-pipeline/callback";
const FFMPEG =
  process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)
    ? process.env.FFMPEG_PATH
    : "/usr/bin/ffmpeg";
const FFPROBE =
  process.env.FFPROBE_PATH && existsSync(process.env.FFPROBE_PATH)
    ? process.env.FFPROBE_PATH
    : "/usr/bin/ffprobe";

export class InvalidVideoError extends Error {
  readonly retryable = false;
}

type VideoProbe = { width: number; height: number; durationSeconds: number };
type ProbeJson = {
  format?: { format_name?: string; duration?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    pix_fmt?: string;
    profile?: string;
    width?: number;
    height?: number;
    duration?: string;
  }>;
};

/** Validate the actual streams; names and declared MIME are not authoritative. */
export async function probeVideo(
  filePath: string,
  contentType: VideoMime,
): Promise<VideoProbe> {
  let parsed: ProbeJson;
  try {
    const { stdout } = await run(
      FFPROBE,
      [
        "-v",
        "error",
        "-show_entries",
        "format=format_name,duration:stream=codec_type,codec_name,pix_fmt,profile,width,height,duration",
        "-of",
        "json",
        filePath,
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    parsed = JSON.parse(stdout) as ProbeJson;
  } catch {
    throw new InvalidVideoError("The file is not a readable video");
  }
  const streams = parsed.streams ?? [];
  const videos = streams.filter((stream) => stream.codec_type === "video");
  const audios = streams.filter((stream) => stream.codec_type === "audio");
  if (videos.length !== 1 || audios.length > 1)
    throw new InvalidVideoError(
      "Use a video with one video track and at most one audio track",
    );
  const video = videos[0]!;
  const container = parsed.format?.format_name?.split(",") ?? [];
  if (contentType === "video/mp4") {
    if (
      !container.some((name) =>
        ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"].includes(name),
      ) ||
      video.codec_name !== "h264" ||
      !["yuv420p", "yuvj420p"].includes(video.pix_fmt ?? "") ||
      audios.some((audio) => audio.codec_name !== "aac")
    )
      throw new InvalidVideoError(
        "MP4 videos must use H.264 video and optional AAC audio",
      );
  } else if (
    (!container.includes("matroska") && !container.includes("webm")) ||
    !["vp8", "vp9"].includes(video.codec_name ?? "") ||
    video.pix_fmt !== "yuv420p" ||
    audios.some((audio) => !["opus", "vorbis"].includes(audio.codec_name ?? ""))
  ) {
    throw new InvalidVideoError(
      "WebM videos must use VP8 or VP9 video and optional Opus or Vorbis audio",
    );
  }
  const durationSeconds = Number(video.duration ?? parsed.format?.duration);
  if (
    !video.width ||
    !video.height ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  )
    throw new InvalidVideoError(
      "Video dimensions or duration could not be read",
    );
  if (video.width * video.height > 40_000_000)
    throw new InvalidVideoError("Video frame resolution is too large");
  return { width: video.width, height: video.height, durationSeconds };
}

function videoType(contentType: string | undefined): VideoMime {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalized === "video/mp4" || normalized === "video/webm")
    return normalized;
  throw new InvalidVideoError("Only MP4 and WebM videos are supported");
}

async function posterVariants(
  filePath: string,
  durationSeconds: number,
  bucket: string,
  prefix: string,
) {
  const candidates = [
    ...new Set([
      Math.min(0.5, durationSeconds * 0.1),
      Math.min(1.5, durationSeconds * 0.15),
      Math.min(3, durationSeconds * 0.2),
    ]),
  ];
  const frames: Array<{ bytes: Buffer; score: number }> = [];
  for (const second of candidates) {
    try {
      const { stdout } = await run(
        FFMPEG,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-ss",
          String(second),
          "-i",
          filePath,
          "-frames:v",
          "1",
          "-f",
          "image2pipe",
          "-vcodec",
          "png",
          "-",
        ],
        { timeout: 45_000, maxBuffer: 100 * 1024 * 1024, encoding: "buffer" },
      );
      const bytes = Buffer.from(stdout);
      const stats = await sharp(bytes, {
        limitInputPixels: 40_000_000,
      }).stats();
      const score = stats.channels
        .slice(0, 3)
        .reduce((sum, c) => sum + c.mean + c.stdev * 2, 0);
      frames.push({ bytes, score });
    } catch {
      // Seek points near the start can be undecodable; try the next one.
    }
  }
  const frame = frames.sort((a, b) => b.score - a.score)[0];
  if (!frame) throw new InvalidVideoError("Could not extract a video poster");
  const rendition = async (
    role: "original" | "display" | "preview",
    width?: number,
  ) => {
    let processor = sharp(frame.bytes, { limitInputPixels: 40_000_000 });
    if (width)
      processor = processor.resize(width, undefined, {
        withoutEnlargement: true,
      });
    const bytes = await processor
      .webp({ quality: role === "original" ? 88 : 82 })
      .toBuffer();
    const metadata = await sharp(bytes).metadata();
    const suffix = role === "original" ? "" : `-${role}`;
    const objectKey = `${prefix}/poster${suffix}.webp`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return {
      role,
      objectKey,
      width: metadata.width!,
      height: metadata.height!,
      contentType: "image/webp" as const,
      sizeBytes: bytes.byteLength,
    };
  };
  const [original, display, preview] = await Promise.all([
    rendition("original"),
    rendition("display", 960),
    rendition("preview", 320),
  ]);
  return { original, display, preview };
}

export async function processStoredVideo(input: {
  bucket: string;
  objectKey: string;
  originalEtag: string;
  sizeBytes?: number;
}): Promise<void> {
  if (input.sizeBytes && input.sizeBytes > MAX_BYTES)
    throw new InvalidVideoError("Video exceeds the 250 MB limit");
  const folder = await mkdtemp(path.join(tmpdir(), "aska-video-"));
  try {
    const source = await s3.send(
      new GetObjectCommand({ Bucket: input.bucket, Key: input.objectKey }),
    );
    const etag = source.ETag?.replaceAll('"', "") ?? input.originalEtag;
    if (!source.Body || !etag) throw new Error("Video object is missing");
    if (!source.ContentLength || source.ContentLength > MAX_BYTES)
      throw new InvalidVideoError("Video exceeds the 250 MB limit");
    const started = await callPipeline<{ ignored: boolean; cleanup?: boolean }>(
      CALLBACK_PATH,
      {
        event: "video.processing.started",
        originalObjectKey: input.objectKey,
        originalEtag: etag,
      },
    );
    if (started.ignored) {
      if (started.cleanup)
        await removeVideoObjects(input.bucket, input.objectKey);
      return;
    }
    const contentType = videoType(source.ContentType);
    const inputPath = path.join(folder, "source");
    const { pipeline } = await import("node:stream/promises");
    const { createWriteStream } = await import("node:fs");
    await pipeline(
      source.Body as NodeJS.ReadableStream,
      createWriteStream(inputPath),
    );
    const probe = await probeVideo(inputPath, contentType);
    const prefix = input.objectKey.slice(0, input.objectKey.lastIndexOf("/"));
    const poster = await posterVariants(
      inputPath,
      probe.durationSeconds,
      input.bucket,
      prefix,
    );
    const completed = await callPipeline<{
      ignored: boolean;
      cleanup?: boolean;
    }>(CALLBACK_PATH, {
      event: "video.processing.completed",
      originalObjectKey: input.objectKey,
      originalEtag: etag,
      contentType,
      sizeBytes: source.ContentLength,
      ...probe,
      poster,
    });
    if (completed.cleanup)
      await removeVideoObjects(input.bucket, input.objectKey);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export async function processRemoteVideo(uploadId: number): Promise<void> {
  type Claim =
    | { ignored: true }
    | {
        ignored: false;
        url: string;
        organizationId: string;
        storageId: string;
        originalObjectKey: string | null;
      };
  const claim = await callPipeline<Claim>(
    "/api/v1/internal/video-pipeline/claim",
    { uploadId },
  );
  if (claim.ignored) return;
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required");
  if (claim.originalObjectKey) {
    try {
      await s3.send(
        new HeadObjectCommand({ Bucket: bucket, Key: claim.originalObjectKey }),
      );
      return;
    } catch {
      // The registration may have succeeded before the object was uploaded.
    }
  }
  const folder = await mkdtemp(path.join(tmpdir(), "aska-video-import-"));
  try {
    const inputPath = path.join(folder, "source");
    const fetched = await safeFetchToFile(claim.url, inputPath, {
      accept: "video/mp4,video/webm",
      allowedContentTypes: MIME_TYPES,
      maxBytes: MAX_BYTES,
      totalTimeoutMs: 7 * 60_000,
      requestTimeoutMs: 30_000,
      userAgent: "Aska-Video-Importer/1.0",
    });
    const contentType = videoType(fetched.contentType);
    await probeVideo(inputPath, contentType);
    const ext = contentType === "video/mp4" ? "mp4" : "webm";
    const originalObjectKey = `${claim.organizationId}/video/${claim.storageId}/original.${ext}`;
    const registration = await callPipeline<{ ignored: boolean }>(
      CALLBACK_PATH,
      {
        event: "video.import.ready",
        uploadId,
        originalObjectKey,
        contentType,
        sizeBytes: fetched.sizeBytes,
        finalUrl: fetched.finalUrl,
      },
    );
    if (registration.ignored) return;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: originalObjectKey,
          Body: createReadStream(inputPath),
          ContentLength: fetched.sizeBytes,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
          IfNoneMatch: "*",
        }),
      );
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 412
      )
        throw error;
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export async function reportStoredFailure(
  input: {
    bucket: string;
    objectKey: string;
    originalEtag?: string;
  },
  error: unknown,
) {
  const message = userFacingError(error);
  const result = await callPipeline<{ ignored: boolean; cleanup?: boolean }>(
    CALLBACK_PATH,
    {
      event: "video.processing.failed",
      originalObjectKey: input.objectKey,
      originalEtag: input.originalEtag,
      error: message,
    },
  );
  if (!result.ignored || result.cleanup)
    await removeVideoObjects(input.bucket, input.objectKey);
}

async function removeVideoObjects(bucket: string, originalKey: string) {
  const prefix = originalKey.slice(0, originalKey.lastIndexOf("/"));
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: [
          originalKey,
          `${prefix}/poster.webp`,
          `${prefix}/poster-display.webp`,
          `${prefix}/poster-preview.webp`,
        ].map((Key) => ({ Key })),
      },
    }),
  );
}

export async function reportRemoteFailure(uploadId: number, error: unknown) {
  await callPipeline(CALLBACK_PATH, {
    event: "video.import.failed",
    uploadId,
    error: userFacingError(error),
  });
}

function userFacingError(error: unknown): string {
  if (error instanceof InvalidVideoError) return error.message;
  if (error instanceof SafeFetchError) {
    if (error.category === "response_too_large")
      return "Video exceeds the 250 MB limit";
    if (error.category === "content_type")
      return "The URL did not return an MP4 or WebM video";
    if (error.category === "unsafe_url")
      return "The video URL is not safe to import";
    return "Could not download the video from this URL";
  }
  return "Video processing failed";
}
