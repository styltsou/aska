import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { assets, colorAssets } from "@/db/schema";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseAssetNodeId } from "@/lib/collection-node-id";
import { getColorName } from "@/lib/color-names";
import {
  gradientFingerprint,
  isMajorGradientChange,
  type StoredColorGradient,
} from "@/lib/color-gradient";
import { matchesGradientNamingJob } from "@/lib/color-naming";
import { rewriteReferencedTargetLabel } from "@/services/note-mention.service";
import { TaskQueueService } from "@/services/task-queue.service";
import { env } from "@/config";
import type {
  GradientNamingFailure,
  GradientNamingJob,
} from "../../../services/gradient-naming/src/job";

const queue = new TaskQueueService();

function describeStopColor(hex: string): string {
  const channels = [1, 3, 5].map(
    (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const brightness =
    channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  const spread = Math.max(...channels) - Math.min(...channels);
  const tone = brightness < 0.3 ? "dark" : brightness > 0.76 ? "light" : "mid";
  const saturation =
    spread < 0.18 ? "muted" : spread > 0.48 ? "vivid" : "balanced";
  return `${tone} ${saturation}`;
}

export type NamingState = {
  state: "queued" | "prompt" | "none" | "failed" | "succeeded";
  fingerprint?: string;
  error?: GradientNamingFailure;
};

export type GradientNamingQueueResult = {
  queued: boolean;
  fingerprint?: string;
  error?: GradientNamingFailure;
};

export function namingStateFromQueue(
  result: GradientNamingQueueResult,
): NamingState {
  if (result.queued)
    return result.fingerprint
      ? { state: "queued", fingerprint: result.fingerprint }
      : { state: "queued" };
  if (result.error) return { state: "failed", error: result.error };
  return { state: "none" };
}

export function namingStateFromStored(
  status: string | null,
  fingerprint: string | null,
  error: string | null,
): NamingState | undefined {
  if (status === "queued" && fingerprint)
    return { state: "queued", fingerprint };
  if (
    status === "failed" &&
    (error === "missing_api_key" ||
      error === "usage_limit" ||
      error === "provider_unavailable" ||
      error === "internal_error")
  )
    return { state: "failed", error };
  if (status === "succeeded") return { state: "succeeded" };
  return undefined;
}

export async function queueGradientName(
  assetId: number,
  gradient: StoredColorGradient,
  expectedTitle: string,
  expectedManual: boolean,
): Promise<GradientNamingQueueResult> {
  if (env.GRADIENT_NAMING_PROVIDER === "off") return { queued: false };
  const job: GradientNamingJob = {
    version: 1,
    kind: "gradient.name",
    assetId,
    fingerprint: gradientFingerprint(gradient),
    expectedTitle,
    expectedManual,
  };
  await db
    .update(colorAssets)
    .set({
      nameJobFingerprint: job.fingerprint,
      nameJobStatus: "queued",
      nameJobError: null,
    })
    .where(eq(colorAssets.assetId, assetId));
  try {
    const queued = await queue.enqueueGradientName(job);
    if (queued) return { queued: true, fingerprint: job.fingerprint };
    await recordGradientNameFailure(job, "internal_error");
    return { queued: false, error: "internal_error" };
  } catch (error) {
    console.warn("Unable to queue gradient name", { assetId, error });
    await recordGradientNameFailure(job, "internal_error");
    return { queued: false, error: "internal_error" };
  }
}

export async function recordGradientNameFailure(
  job: GradientNamingJob,
  failure: GradientNamingFailure,
) {
  const [row] = await db
    .select({
      title: assets.title,
      gradient: colorAssets.gradient,
      nameEditedByUser: colorAssets.nameEditedByUser,
      nameBasis: colorAssets.nameBasis,
      nameJobStatus: colorAssets.nameJobStatus,
      nameJobFingerprint: colorAssets.nameJobFingerprint,
    })
    .from(assets)
    .innerJoin(colorAssets, eq(colorAssets.assetId, assets.id))
    .where(and(eq(assets.id, job.assetId), eq(assets.type, "color")))
    .limit(1);
  if (
    !row ||
    row.nameJobStatus !== "queued" ||
    row.nameJobFingerprint !== job.fingerprint ||
    !matchesGradientNamingJob(row, job)
  )
    return { recorded: false };
  await db
    .update(colorAssets)
    .set({ nameJobStatus: "failed", nameJobError: failure })
    .where(
      and(
        eq(colorAssets.assetId, job.assetId),
        eq(colorAssets.nameJobFingerprint, job.fingerprint),
        eq(colorAssets.nameJobStatus, "queued"),
      ),
    );
  return { recorded: true };
}

export function validateGeneratedTitle(value: string): string | null {
  const title = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
  if (
    title.length < 2 ||
    title.length > 60 ||
    /\b(?:gradient|to)\b/i.test(title)
  )
    return null;
  if (!/^[\p{L}][\p{L}'’-]*(?: [\p{L}][\p{L}'’-]*){0,2}$/u.test(title))
    return null;
  return title
    .split(" ")
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function currentNamingTarget(assetId: number) {
  const [row] = await db
    .select({
      id: assets.id,
      organizationId: assets.organizationId,
      title: assets.title,
      gradient: colorAssets.gradient,
      nameEditedByUser: colorAssets.nameEditedByUser,
      nameBasis: colorAssets.nameBasis,
      nameJobStatus: colorAssets.nameJobStatus,
      nameJobFingerprint: colorAssets.nameJobFingerprint,
    })
    .from(assets)
    .innerJoin(colorAssets, eq(colorAssets.assetId, assets.id))
    .where(and(eq(assets.id, assetId), eq(assets.type, "color")))
    .limit(1);
  return row;
}

export async function claimGradientName(job: GradientNamingJob) {
  const row = await currentNamingTarget(job.assetId);
  if (
    !row ||
    row.nameJobStatus !== "queued" ||
    row.nameJobFingerprint !== job.fingerprint ||
    !matchesGradientNamingJob(row, job)
  )
    return { ignored: true as const };
  const gradient = row.gradient!;
  const stops = gradient.stops?.length
    ? gradient.stops
    : [
        { color: gradient.from, position: 0 },
        { color: gradient.to, position: 100 },
      ];
  return {
    ignored: false as const,
    type: gradient.type ?? "linear",
    stops: stops.map((stop) => ({
      name: getColorName(stop.color) ?? "Unknown color",
      descriptor: describeStopColor(stop.color),
      position: stop.position,
    })),
  };
}

export async function completeGradientName(
  job: GradientNamingJob,
  proposed: string,
) {
  const title = validateGeneratedTitle(proposed);
  if (!title) {
    await recordGradientNameFailure(job, "internal_error");
    return { applied: false };
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: assets.id,
        organizationId: assets.organizationId,
        title: assets.title,
        gradient: colorAssets.gradient,
        nameEditedByUser: colorAssets.nameEditedByUser,
        nameBasis: colorAssets.nameBasis,
        nameJobStatus: colorAssets.nameJobStatus,
        nameJobFingerprint: colorAssets.nameJobFingerprint,
      })
      .from(assets)
      .innerJoin(colorAssets, eq(colorAssets.assetId, assets.id))
      .where(and(eq(assets.id, job.assetId), eq(assets.type, "color")))
      .for("update")
      .limit(1);
    if (
      !row ||
      row.nameJobStatus !== "queued" ||
      row.nameJobFingerprint !== job.fingerprint ||
      !matchesGradientNamingJob(row, job)
    )
      return { applied: false };
    await tx.update(assets).set({ title }).where(eq(assets.id, row.id));
    await tx
      .update(colorAssets)
      .set({
        nameEditedByUser: false,
        nameBasis: row.gradient,
        nameJobStatus: "succeeded",
        nameJobError: null,
      })
      .where(eq(colorAssets.assetId, row.id));
    await rewriteReferencedTargetLabel(
      tx,
      row.organizationId,
      row.id,
      "color",
      title,
    );
    return { applied: true };
  });
}

export async function actOnGradientName(
  orgId: string,
  assetNodeId: string,
  action: "generate" | "keep",
  fingerprint: string,
) {
  const target = parseAssetNodeId(assetNodeId);
  if (target.assetType !== "color")
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Asset is not a color");
  const row = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: assets.id,
        title: assets.title,
        gradient: colorAssets.gradient,
        nameBasis: colorAssets.nameBasis,
        nameEditedByUser: colorAssets.nameEditedByUser,
      })
      .from(assets)
      .innerJoin(colorAssets, eq(colorAssets.assetId, assets.id))
      .where(
        and(
          eq(assets.id, target.entityId),
          eq(assets.organizationId, orgId),
          eq(assets.type, "color"),
        ),
      )
      .for("update")
      .limit(1);
    if (!current || !current.gradient)
      throw new AppError(ErrorCode.NOT_FOUND, "Gradient not found");
    if (gradientFingerprint(current.gradient) !== fingerprint)
      throw new AppError(
        ErrorCode.CONFLICT,
        "Gradient changed since the prompt",
      );
    if (
      !current.nameEditedByUser ||
      !isMajorGradientChange(current.nameBasis, current.gradient)
    )
      throw new AppError(
        ErrorCode.CONFLICT,
        "Rename prompt is no longer current",
      );
    if (action === "keep") {
      await tx
        .update(colorAssets)
        .set({ nameBasis: current.gradient })
        .where(eq(colorAssets.assetId, current.id));
    }
    return current;
  });
  if (action === "keep") return { queued: false };
  return queueGradientName(row.id, row.gradient!, row.title ?? "", true);
}
