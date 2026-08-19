import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import { env } from "@/config";
import { db } from "@/db";
import {
  assets,
  collectionNodes,
  externalResourceMedia,
  externalResources,
  linkAssets,
  mediaCleanupJobs,
  resourceResolutionAttempts,
} from "@/db/schema";
import type { CollectionLinkNode } from "@/dto/collection.dto";
import type {
  CreateLinkInput,
  ResolutionResultInput,
  ResourceMediaResultInput,
} from "@/dto/url-unfurl.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseAssetNodeId } from "@/lib/collection-node-id";
import { first } from "@/lib/query";
import { resolveCollectionTargetBySlug } from "@/services/collection/collection-target-resolver";
import type { ILoggerService } from "@/services/logger.service";
import type { IObjectStorageService } from "@/services/object-storage.service";
import type { ITaskQueueService } from "@/services/task-queue.service";
import {
  getResourceMediaLookup,
  projectLinkNode,
  type LinkProjectionRow,
} from "./projection";
import {
  hashExternalUrl,
  normalizeDiscoveredUrl,
  normalizeExternalUrl,
} from "./url-normalization";

const RESOLVER_KEY = "generic-html";
const RESOLVER_VERSION = "1";
const ACTIVE_LEASE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS_PER_WORKSPACE_PER_HOUR = 60;
const ORPHAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

type CreateTarget = {
  collectionSlug: string | null;
};

export type ResolutionClaim =
  | { ignored: true }
  | {
      ignored: false;
      attemptId: number;
      generation: number;
      url: string;
      resolverKey: string;
      resolverVersion: string;
    };

export type MediaClaim =
  | { ignored: true }
  | {
      ignored: false;
      mediaId: number;
      generation: number;
      url: string;
      organizationId: string;
      storageId: string;
      role: "preview" | "icon" | "primary" | "cover";
      processingProfile: string;
    };

export class UrlUnfurlService {
  constructor(
    private readonly queue: ITaskQueueService,
    private readonly objectStorage: IObjectStorageService,
    private readonly logger: ILoggerService,
  ) {}

  createCollectionLink(
    orgId: string,
    userId: string,
    collectionSlug: string,
    input: CreateLinkInput,
  ): Promise<CollectionLinkNode> {
    return this.createLink(orgId, userId, input, { collectionSlug });
  }

  createInboxLink(
    orgId: string,
    userId: string,
    input: CreateLinkInput,
  ): Promise<CollectionLinkNode> {
    return this.createLink(orgId, userId, input, { collectionSlug: null });
  }

  private async createLink(
    orgId: string,
    userId: string,
    input: CreateLinkInput,
    targetInput: CreateTarget,
  ): Promise<CollectionLinkNode> {
    const normalized = normalizeExternalUrl(input.url);
    const target = await resolveCollectionTargetBySlug(
      orgId,
      targetInput.collectionSlug,
      input.parentFolderPath,
    );

    const result = await db.transaction(async (tx) => {
      let resource = first(
        await tx
          .select()
          .from(externalResources)
          .where(
            and(
              eq(externalResources.organizationId, orgId),
              eq(
                externalResources.normalizedUrlHash,
                normalized.normalizedUrlHash,
              ),
            ),
          )
          .limit(1),
      );

      let isNew = false;
      if (!resource) {
        resource = first(
          await tx
            .insert(externalResources)
            .values({
              organizationId: orgId,
              normalizedUrl: normalized.normalizedUrl,
              normalizedUrlHash: normalized.normalizedUrlHash,
              hostname: normalized.hostname,
              resolutionStatus: normalized.resolutionAllowed
                ? "queued"
                : "failed",
              failureCategory: normalized.blockedReason ?? null,
              staleAt: normalized.resolutionAllowed
                ? null
                : new Date(
                    Date.now() + env.URL_UNFURL_FAILURE_TTL_SECONDS * 1000,
                  ),
            })
            .onConflictDoNothing()
            .returning(),
        );
        isNew = Boolean(resource);
        if (!resource) {
          resource = first(
            await tx
              .select()
              .from(externalResources)
              .where(
                and(
                  eq(externalResources.organizationId, orgId),
                  eq(
                    externalResources.normalizedUrlHash,
                    normalized.normalizedUrlHash,
                  ),
                ),
              )
              .limit(1),
          );
        }
      }

      if (!resource || resource.normalizedUrl !== normalized.normalizedUrl) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Unable to establish URL resource identity",
        );
      }

      await tx
        .update(externalResources)
        .set({ unreferencedAt: null })
        .where(eq(externalResources.id, resource.id));

      const [asset] = await tx
        .insert(assets)
        .values({
          organizationId: orgId,
          type: "link",
          createdByUserId: userId,
          updatedByUserId: userId,
          ...(target ? {} : { lastAddedToInboxAt: new Date() }),
        })
        .returning();
      if (!asset)
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create link");

      await tx.insert(linkAssets).values({
        assetId: asset.id,
        organizationId: orgId,
        resourceId: resource.id,
        originalUrl: normalized.originalUrl,
      });
      if (target) {
        await tx.insert(collectionNodes).values({
          organizationId: orgId,
          collectionId: target.collection.id,
          parentFolderId: target.parentFolderId,
          nodeType: "asset",
          assetId: asset.id,
          positionX: input.position?.x,
          positionY: input.position?.y,
          depth: target.pathFolderSlugs.length,
          pathFolderIds: target.pathFolderIds,
          pathFolderSlugs: target.pathFolderSlugs,
          pathFolderNames: target.pathFolderNames,
        });
      }

      let attemptId: number | undefined;
      const active =
        resource.resolutionStatus === "queued" ||
        resource.resolutionStatus === "resolving";
      const isStale = Boolean(
        resource.staleAt && resource.staleAt <= new Date(),
      );
      const retryableFailure =
        resource.resolutionStatus === "failed" &&
        resource.updatedAt.getTime() +
          env.URL_UNFURL_FAILURE_TTL_SECONDS * 1000 <=
          Date.now();
      let queuedGeneration = resource.resolutionGeneration;
      if (
        normalized.resolutionAllowed &&
        (isNew || (!active && (isStale || retryableFailure)))
      ) {
        const generation = isNew
          ? resource.resolutionGeneration
          : resource.resolutionGeneration + 1;
        queuedGeneration = generation;
        await this.assertWorkspaceAttemptQuota(tx, orgId);
        if (!isNew) {
          await tx
            .update(externalResources)
            .set({
              resolutionGeneration: generation,
              resolutionStatus: "queued",
              failureCategory: null,
            })
            .where(eq(externalResources.id, resource.id));
        }
        const [attempt] = await tx
          .insert(resourceResolutionAttempts)
          .values({
            organizationId: orgId,
            resourceId: resource.id,
            generation,
            trigger: isNew ? "paste" : "stale_revalidation",
            resolverKey: RESOLVER_KEY,
            resolverVersion: RESOLVER_VERSION,
          })
          .returning({ id: resourceResolutionAttempts.id });
        attemptId = attempt?.id;
      }

      return { assetId: asset.id, attemptId, generation: queuedGeneration };
    });

    if (result.attemptId) {
      await this.enqueueResolutionOrFail(result.attemptId, result.generation);
    }
    return this.getLinkNode(orgId, result.assetId, input.position ?? null);
  }

  async refreshLink(
    orgId: string,
    assetNodeId: string,
  ): Promise<CollectionLinkNode> {
    const parsed = parseAssetNodeId(assetNodeId);
    if (parsed.assetType !== "link")
      throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
    const row = first(
      await db
        .select({ resourceId: linkAssets.resourceId })
        .from(linkAssets)
        .innerJoin(assets, eq(assets.id, linkAssets.assetId))
        .where(
          and(
            eq(linkAssets.assetId, parsed.entityId),
            eq(linkAssets.organizationId, orgId),
            eq(assets.type, "link"),
          ),
        )
        .limit(1),
    );
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Link not found");

    const queued = await db.transaction(async (tx) => {
      await this.assertWorkspaceAttemptQuota(tx, orgId);
      const resource = first(
        await tx
          .select()
          .from(externalResources)
          .where(
            and(
              eq(externalResources.id, row.resourceId),
              eq(externalResources.organizationId, orgId),
            ),
          )
          .limit(1),
      );
      if (!resource)
        throw new AppError(ErrorCode.NOT_FOUND, "Link resource not found");
      const normalized = normalizeExternalUrl(resource.normalizedUrl);
      if (!normalized.resolutionAllowed) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "This URL cannot be resolved because it contains credentials or a sensitive query parameter",
        );
      }
      const existing = first(
        await tx
          .select({
            id: resourceResolutionAttempts.id,
            generation: resourceResolutionAttempts.generation,
          })
          .from(resourceResolutionAttempts)
          .where(
            and(
              eq(resourceResolutionAttempts.resourceId, resource.id),
              inArray(resourceResolutionAttempts.status, [
                "queued",
                "processing",
              ]),
            ),
          )
          .limit(1),
      );
      if (existing)
        return {
          attemptId: existing.id,
          generation: existing.generation,
          enqueue: false,
        };

      const generation = resource.resolutionGeneration + 1;
      await tx
        .update(externalResources)
        .set({
          resolutionGeneration: generation,
          resolutionStatus: "queued",
          failureCategory: null,
        })
        .where(eq(externalResources.id, resource.id));
      const [attempt] = await tx
        .insert(resourceResolutionAttempts)
        .values({
          organizationId: orgId,
          resourceId: resource.id,
          generation,
          trigger: "manual_refresh",
          resolverKey: RESOLVER_KEY,
          resolverVersion: RESOLVER_VERSION,
        })
        .returning({ id: resourceResolutionAttempts.id });
      if (!attempt)
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to queue refresh");
      return { attemptId: attempt.id, generation, enqueue: true };
    });
    if (queued.enqueue)
      await this.enqueueResolutionOrFail(queued.attemptId, queued.generation);
    return this.getLinkNode(orgId, parsed.entityId, null);
  }

  async claimResolution(
    attemptId: number,
    generation: number,
  ): Promise<ResolutionClaim> {
    const staleBefore = new Date(Date.now() - ACTIVE_LEASE_MS);
    const row = first(
      await db
        .select({
          attemptId: resourceResolutionAttempts.id,
          attemptStatus: resourceResolutionAttempts.status,
          processingStartedAt: resourceResolutionAttempts.processingStartedAt,
          resourceId: externalResources.id,
          currentGeneration: externalResources.resolutionGeneration,
          url: externalResources.normalizedUrl,
          resolverKey: resourceResolutionAttempts.resolverKey,
          resolverVersion: resourceResolutionAttempts.resolverVersion,
        })
        .from(resourceResolutionAttempts)
        .innerJoin(
          externalResources,
          eq(externalResources.id, resourceResolutionAttempts.resourceId),
        )
        .where(
          and(
            eq(resourceResolutionAttempts.id, attemptId),
            eq(resourceResolutionAttempts.generation, generation),
          ),
        )
        .limit(1),
    );
    if (!row || row.currentGeneration !== generation) return { ignored: true };
    const reference = first(
      await db
        .select({ id: linkAssets.assetId })
        .from(linkAssets)
        .where(eq(linkAssets.resourceId, row.resourceId))
        .limit(1),
    );
    if (!reference) {
      await db
        .update(resourceResolutionAttempts)
        .set({ status: "cancelled", finishedAt: new Date() })
        .where(eq(resourceResolutionAttempts.id, attemptId));
      return { ignored: true };
    }
    const [claimed] = await db
      .update(resourceResolutionAttempts)
      .set({
        status: "processing",
        processingStartedAt: new Date(),
        attempts: sqlIncrement(resourceResolutionAttempts.attempts),
      })
      .where(
        and(
          eq(resourceResolutionAttempts.id, attemptId),
          or(
            eq(resourceResolutionAttempts.status, "queued"),
            and(
              eq(resourceResolutionAttempts.status, "processing"),
              lt(resourceResolutionAttempts.processingStartedAt, staleBefore),
            ),
          ),
        ),
      )
      .returning({ id: resourceResolutionAttempts.id });
    if (!claimed) return { ignored: true };
    await db
      .update(externalResources)
      .set({ resolutionStatus: "resolving" })
      .where(
        and(
          eq(externalResources.id, row.resourceId),
          eq(externalResources.resolutionGeneration, generation),
        ),
      );
    return {
      ignored: false,
      attemptId,
      generation,
      url: row.url,
      resolverKey: row.resolverKey,
      resolverVersion: row.resolverVersion,
    };
  }

  async handleResolutionResult(
    input: ResolutionResultInput,
  ): Promise<{ ignored: boolean }> {
    const attempt = first(
      await db
        .select({
          resourceId: resourceResolutionAttempts.resourceId,
          organizationId: resourceResolutionAttempts.organizationId,
        })
        .from(resourceResolutionAttempts)
        .innerJoin(
          externalResources,
          eq(externalResources.id, resourceResolutionAttempts.resourceId),
        )
        .where(
          and(
            eq(resourceResolutionAttempts.id, input.id),
            eq(resourceResolutionAttempts.generation, input.generation),
            eq(externalResources.resolutionGeneration, input.generation),
          ),
        )
        .limit(1),
    );
    if (!attempt) return { ignored: true };

    if (input.event === "resource.metadata.failed") {
      const staleAt = new Date(
        Date.now() + env.URL_UNFURL_FAILURE_TTL_SECONDS * 1000,
      );
      await db.transaction(async (tx) => {
        await tx
          .update(resourceResolutionAttempts)
          .set({
            status: "failed",
            failureCategory: input.failureCategory,
            diagnosticCode: input.diagnosticCode,
            httpStatus: input.httpStatus ?? null,
            finishedAt: new Date(),
          })
          .where(eq(resourceResolutionAttempts.id, input.id));
        await tx
          .update(externalResources)
          .set({
            resolutionStatus: "failed",
            failureCategory: input.failureCategory,
            staleAt,
          })
          .where(
            and(
              eq(externalResources.id, attempt.resourceId),
              eq(externalResources.resolutionGeneration, input.generation),
            ),
          );
      });
      this.logger.warn("URL resolution failed", {
        event_name: "url_resolution_failed",
        resource_id: attempt.resourceId,
        attempt_id: input.id,
        generation: input.generation,
        failure_category: input.failureCategory,
      });
      return { ignored: false };
    }

    const mediaToQueue: Array<{ id: number; generation: number }> = [];
    await db.transaction(async (tx) => {
      const oldMedia = await tx
        .select({
          id: externalResourceMedia.id,
          role: externalResourceMedia.role,
          sourceUrlHash: externalResourceMedia.sourceUrlHash,
          processingProfile: externalResourceMedia.processingProfile,
          variants: externalResourceMedia.variants,
        })
        .from(externalResourceMedia)
        .where(eq(externalResourceMedia.resourceId, attempt.resourceId));
      const oldByRole = new Map(oldMedia.map((item) => [item.role, item]));
      for (const discovery of input.media.filter(
        (item) => item.role === "preview" || item.role === "icon",
      )) {
        const sourceUrl = normalizeDiscoveredUrl(
          discovery.sourceUrl,
          input.finalUrl,
        );
        const sourceUrlHash = hashExternalUrl(sourceUrl);
        const existing = oldByRole.get(discovery.role);
        if (
          existing &&
          existing.sourceUrlHash === sourceUrlHash &&
          existing.processingProfile === discovery.processingProfile
        )
          continue;
        if (existing) {
          const objectKeys = Object.values(existing.variants).flatMap(
            (variant) => (variant?.objectKey ? [variant.objectKey] : []),
          );
          if (objectKeys.length > 0)
            await tx
              .insert(mediaCleanupJobs)
              .values({ organizationId: attempt.organizationId, objectKeys });
        }
        const storageId = crypto.randomUUID();
        const [media] = await tx
          .insert(externalResourceMedia)
          .values({
            organizationId: attempt.organizationId,
            resourceId: attempt.resourceId,
            role: discovery.role,
            sourceUrl,
            sourceUrlHash,
            sourceResolver: input.resolverKey,
            sourceMetadata: discovery.sourceMetadata,
            processingProfile: discovery.processingProfile,
            generation: input.generation,
            status: "queued",
            storageId,
            alt: discovery.alt ?? null,
          })
          .onConflictDoUpdate({
            target: [
              externalResourceMedia.resourceId,
              externalResourceMedia.role,
              externalResourceMedia.ordinal,
            ],
            set: {
              sourceUrl,
              sourceUrlHash,
              sourceResolver: input.resolverKey,
              sourceMetadata: discovery.sourceMetadata,
              processingProfile: discovery.processingProfile,
              generation: input.generation,
              status: "queued",
              storageId,
              variants: {},
              blurDataURL: null,
              width: null,
              height: null,
              format: null,
              sizeBytes: null,
              alt: discovery.alt ?? null,
              failureCategory: null,
              enqueuedAt: null,
              processingStartedAt: null,
              finishedAt: null,
            },
          })
          .returning({ id: externalResourceMedia.id });
        if (media)
          mediaToQueue.push({ id: media.id, generation: input.generation });
      }
      await tx
        .update(resourceResolutionAttempts)
        .set({
          status: "succeeded",
          finishedAt: new Date(),
          failureCategory: null,
          diagnosticCode: null,
        })
        .where(eq(resourceResolutionAttempts.id, input.id));
      await tx
        .update(externalResources)
        .set({
          canonicalUrl: input.canonicalUrl
            ? normalizeDiscoveredUrl(input.canonicalUrl, input.finalUrl)
            : null,
          title: input.title,
          description: input.description,
          siteName: input.siteName,
          resourceKind: input.resourceKind,
          resolverKey: input.resolverKey,
          resolverVersion: input.resolverVersion,
          fieldProvenance: input.fieldProvenance,
          providerExtensions: input.providerExtensions,
          resolutionStatus: mediaToQueue.length > 0 ? "resolving" : "ready",
          failureCategory: null,
          resolvedAt: new Date(),
          staleAt: new Date(
            Date.now() + env.URL_UNFURL_SUCCESS_TTL_SECONDS * 1000,
          ),
        })
        .where(
          and(
            eq(externalResources.id, attempt.resourceId),
            eq(externalResources.resolutionGeneration, input.generation),
          ),
        );
    });

    for (const media of mediaToQueue)
      await this.enqueueMediaOrFail(
        media.id,
        media.generation,
        attempt.resourceId,
      );
    this.logger.info("URL resolution completed", {
      event_name: "url_resolution_succeeded",
      resource_id: attempt.resourceId,
      attempt_id: input.id,
      generation: input.generation,
      media_count: mediaToQueue.length,
      resolver_key: input.resolverKey,
      resolver_version: input.resolverVersion,
    });
    return { ignored: false };
  }

  async claimResourceMedia(
    mediaId: number,
    generation: number,
  ): Promise<MediaClaim> {
    const staleBefore = new Date(Date.now() - ACTIVE_LEASE_MS);
    const row = first(
      await db
        .select({
          id: externalResourceMedia.id,
          resourceId: externalResourceMedia.resourceId,
          organizationId: externalResourceMedia.organizationId,
          currentGeneration: externalResources.resolutionGeneration,
          sourceUrl: externalResourceMedia.sourceUrl,
          storageId: externalResourceMedia.storageId,
          role: externalResourceMedia.role,
          processingProfile: externalResourceMedia.processingProfile,
        })
        .from(externalResourceMedia)
        .innerJoin(
          externalResources,
          eq(externalResources.id, externalResourceMedia.resourceId),
        )
        .where(
          and(
            eq(externalResourceMedia.id, mediaId),
            eq(externalResourceMedia.generation, generation),
          ),
        )
        .limit(1),
    );
    if (!row || row.currentGeneration !== generation) return { ignored: true };
    const [claimed] = await db
      .update(externalResourceMedia)
      .set({ status: "processing", processingStartedAt: new Date() })
      .where(
        and(
          eq(externalResourceMedia.id, mediaId),
          or(
            eq(externalResourceMedia.status, "queued"),
            and(
              eq(externalResourceMedia.status, "processing"),
              lt(externalResourceMedia.processingStartedAt, staleBefore),
            ),
          ),
        ),
      )
      .returning({ id: externalResourceMedia.id });
    if (!claimed) return { ignored: true };
    return {
      ignored: false,
      mediaId,
      generation,
      url: row.sourceUrl,
      organizationId: row.organizationId,
      storageId: row.storageId,
      role: row.role,
      processingProfile: row.processingProfile,
    };
  }

  async handleResourceMediaResult(
    input: ResourceMediaResultInput,
  ): Promise<{ ignored: boolean }> {
    const mediaRecord = first(
      await db
        .select({
          resourceId: externalResourceMedia.resourceId,
          organizationId: externalResourceMedia.organizationId,
          currentGeneration: externalResources.resolutionGeneration,
        })
        .from(externalResourceMedia)
        .innerJoin(
          externalResources,
          eq(externalResources.id, externalResourceMedia.resourceId),
        )
        .where(
          and(
            eq(externalResourceMedia.id, input.id),
            eq(externalResourceMedia.generation, input.generation),
          ),
        )
        .limit(1),
    );
    const row =
      mediaRecord?.currentGeneration === input.generation
        ? mediaRecord
        : undefined;
    if (!row) {
      if (mediaRecord && input.event === "resource.media.completed") {
        const objectKeys = Object.values(input.variants).flatMap((variant) =>
          variant?.objectKey ? [variant.objectKey] : [],
        );
        if (objectKeys.length > 0)
          await db
            .insert(mediaCleanupJobs)
            .values({ organizationId: mediaRecord.organizationId, objectKeys });
      }
      return { ignored: true };
    }
    if (input.event === "resource.media.failed") {
      await db
        .update(externalResourceMedia)
        .set({
          status: "failed",
          failureCategory: input.failureCategory,
          finishedAt: new Date(),
        })
        .where(eq(externalResourceMedia.id, input.id));
    } else {
      await db
        .update(externalResourceMedia)
        .set({
          status: "ready",
          width: input.width,
          height: input.height,
          format: input.format,
          sizeBytes: input.sizeBytes,
          blurDataURL: input.blurDataURL,
          variants: {
            master: input.variants.master,
            ...(input.variants.display
              ? { display: input.variants.display }
              : {}),
            ...(input.variants.preview
              ? { preview: input.variants.preview }
              : {}),
          },
          failureCategory: null,
          finishedAt: new Date(),
        })
        .where(eq(externalResourceMedia.id, input.id));
    }
    await this.recomputeResourceStatus(row.resourceId, input.generation);
    return { ignored: false };
  }

  async markResourceUnreferencedIfNeeded(resourceId: number): Promise<void> {
    const reference = first(
      await db
        .select({ id: linkAssets.assetId })
        .from(linkAssets)
        .where(eq(linkAssets.resourceId, resourceId))
        .limit(1),
    );
    if (!reference)
      await db
        .update(externalResources)
        .set({ unreferencedAt: new Date() })
        .where(eq(externalResources.id, resourceId));
  }

  async runMaintenance(): Promise<{
    resolutionRequeued: number;
    mediaRequeued: number;
    resourcesDeleted: number;
  }> {
    const dispatchBefore = new Date(Date.now() - 5 * 60 * 1000);
    const attempts = await db
      .select({
        id: resourceResolutionAttempts.id,
        generation: resourceResolutionAttempts.generation,
      })
      .from(resourceResolutionAttempts)
      .where(
        or(
          and(
            eq(resourceResolutionAttempts.status, "queued"),
            or(
              isNull(resourceResolutionAttempts.enqueuedAt),
              lte(resourceResolutionAttempts.enqueuedAt, dispatchBefore),
            ),
          ),
          and(
            eq(resourceResolutionAttempts.status, "processing"),
            lte(resourceResolutionAttempts.processingStartedAt, dispatchBefore),
          ),
        ),
      )
      .limit(50);
    let resolutionRequeued = 0;
    for (const attempt of attempts) {
      if (await this.queue.enqueueResolution(attempt.id, attempt.generation)) {
        await db
          .update(resourceResolutionAttempts)
          .set({ enqueuedAt: new Date() })
          .where(eq(resourceResolutionAttempts.id, attempt.id));
        resolutionRequeued += 1;
      }
    }

    const mediaRows = await db
      .select({
        id: externalResourceMedia.id,
        generation: externalResourceMedia.generation,
      })
      .from(externalResourceMedia)
      .where(
        or(
          and(
            eq(externalResourceMedia.status, "queued"),
            or(
              isNull(externalResourceMedia.enqueuedAt),
              lte(externalResourceMedia.enqueuedAt, dispatchBefore),
            ),
          ),
          and(
            eq(externalResourceMedia.status, "processing"),
            lte(externalResourceMedia.processingStartedAt, dispatchBefore),
          ),
        ),
      )
      .limit(50);
    let mediaRequeued = 0;
    for (const media of mediaRows) {
      if (await this.queue.enqueueResourceMedia(media.id, media.generation)) {
        await db
          .update(externalResourceMedia)
          .set({ enqueuedAt: new Date() })
          .where(eq(externalResourceMedia.id, media.id));
        mediaRequeued += 1;
      }
    }

    await db
      .update(externalResources)
      .set({ unreferencedAt: new Date() })
      .where(
        and(
          isNull(externalResources.unreferencedAt),
          notExists(
            db
              .select({ id: linkAssets.assetId })
              .from(linkAssets)
              .where(eq(linkAssets.resourceId, externalResources.id)),
          ),
        ),
      );

    const orphaned = await db
      .select({
        id: externalResources.id,
        organizationId: externalResources.organizationId,
      })
      .from(externalResources)
      .where(
        and(
          lte(
            externalResources.unreferencedAt,
            new Date(Date.now() - ORPHAN_GRACE_MS),
          ),
          notExists(
            db
              .select({ id: linkAssets.assetId })
              .from(linkAssets)
              .where(eq(linkAssets.resourceId, externalResources.id)),
          ),
        ),
      )
      .limit(50);

    for (const resource of orphaned) {
      await db.transaction(async (tx) => {
        const media = await tx
          .select({ variants: externalResourceMedia.variants })
          .from(externalResourceMedia)
          .where(eq(externalResourceMedia.resourceId, resource.id));
        const objectKeys = media.flatMap((row) =>
          Object.values(row.variants).flatMap((variant) =>
            variant?.objectKey ? [variant.objectKey] : [],
          ),
        );
        if (objectKeys.length > 0) {
          await tx.insert(mediaCleanupJobs).values({
            organizationId: resource.organizationId,
            objectKeys: [...new Set(objectKeys)],
          });
        }
        await tx
          .delete(externalResources)
          .where(eq(externalResources.id, resource.id));
      });
    }

    return {
      resolutionRequeued,
      mediaRequeued,
      resourcesDeleted: orphaned.length,
    };
  }

  async getLinkNode(
    orgId: string,
    assetId: number,
    position: CollectionLinkNode["position"],
  ): Promise<CollectionLinkNode> {
    const row = first(
      await db
        .select({
          assetId: assets.id,
          originalUrl: linkAssets.originalUrl,
          resourceId: externalResources.id,
          hostname: externalResources.hostname,
          canonicalUrl: externalResources.canonicalUrl,
          resourceTitle: externalResources.title,
          description: externalResources.description,
          siteName: externalResources.siteName,
          resourceKind: externalResources.resourceKind,
          resolutionStatus: externalResources.resolutionStatus,
          failureCategory: externalResources.failureCategory,
          resolvedAt: externalResources.resolvedAt,
          staleAt: externalResources.staleAt,
          createdAt: assets.createdAt,
        })
        .from(assets)
        .innerJoin(linkAssets, eq(linkAssets.assetId, assets.id))
        .innerJoin(
          externalResources,
          eq(externalResources.id, linkAssets.resourceId),
        )
        .where(
          and(
            eq(assets.id, assetId),
            eq(assets.organizationId, orgId),
            eq(assets.type, "link"),
          ),
        )
        .limit(1),
    );
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
    const media = await getResourceMediaLookup(
      [row.resourceId],
      this.objectStorage,
    );
    return projectLinkNode(
      row satisfies LinkProjectionRow,
      media.get(row.resourceId),
      position,
    );
  }

  private async enqueueResolutionOrFail(attemptId: number, generation: number) {
    try {
      if (!(await this.queue.enqueueResolution(attemptId, generation)))
        throw new Error("resolution_queue_unavailable");
      await db
        .update(resourceResolutionAttempts)
        .set({ enqueuedAt: new Date() })
        .where(eq(resourceResolutionAttempts.id, attemptId));
    } catch {
      await this.handleResolutionResult({
        event: "resource.metadata.failed",
        id: attemptId,
        generation,
        failureCategory: "queue_unavailable",
        diagnosticCode: "resolution_queue_unavailable",
      });
    }
  }

  private async enqueueMediaOrFail(
    mediaId: number,
    generation: number,
    resourceId: number,
  ) {
    try {
      if (!(await this.queue.enqueueResourceMedia(mediaId, generation)))
        throw new Error("media_queue_unavailable");
      await db
        .update(externalResourceMedia)
        .set({ enqueuedAt: new Date() })
        .where(eq(externalResourceMedia.id, mediaId));
    } catch {
      await db
        .update(externalResourceMedia)
        .set({
          status: "failed",
          failureCategory: "queue_unavailable",
          finishedAt: new Date(),
        })
        .where(eq(externalResourceMedia.id, mediaId));
      await this.recomputeResourceStatus(resourceId, generation);
    }
  }

  private async recomputeResourceStatus(
    resourceId: number,
    generation: number,
  ) {
    const rows = await db
      .select({
        status: externalResourceMedia.status,
        role: externalResourceMedia.role,
      })
      .from(externalResourceMedia)
      .where(
        and(
          eq(externalResourceMedia.resourceId, resourceId),
          eq(externalResourceMedia.generation, generation),
        ),
      );
    const active = rows.some(
      (row) =>
        row.status === "discovered" ||
        row.status === "queued" ||
        row.status === "processing",
    );
    const failed = rows.some(
      (row) => row.status === "failed" && row.role !== "icon",
    );
    await db
      .update(externalResources)
      .set({
        resolutionStatus: active ? "resolving" : failed ? "partial" : "ready",
      })
      .where(
        and(
          eq(externalResources.id, resourceId),
          eq(externalResources.resolutionGeneration, generation),
        ),
      );
  }

  private async assertWorkspaceAttemptQuota(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    orgId: string,
  ) {
    const recent = first(
      await tx
        .select({ value: count() })
        .from(resourceResolutionAttempts)
        .where(
          and(
            eq(resourceResolutionAttempts.organizationId, orgId),
            gte(
              resourceResolutionAttempts.createdAt,
              new Date(Date.now() - 60 * 60 * 1000),
            ),
          ),
        ),
    );
    if (Number(recent?.value ?? 0) >= MAX_ATTEMPTS_PER_WORKSPACE_PER_HOUR)
      throw new AppError(
        ErrorCode.RATE_LIMITED,
        "URL resolution limit reached. Try again later.",
      );
  }
}

function sqlIncrement(column: typeof resourceResolutionAttempts.attempts) {
  return sql`${column} + 1`;
}
