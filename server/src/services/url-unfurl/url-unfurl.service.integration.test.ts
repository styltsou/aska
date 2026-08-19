import { randomUUID } from "node:crypto";

import { and, count, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  externalResources,
  organization,
  resourceResolutionAttempts,
  user,
} from "@/db/schema";
import { AssetService } from "@/services/asset.service";
import { CollectionService } from "@/services/collection.service";
import type { ILoggerService } from "@/services/logger.service";
import type { IObjectStorageService } from "@/services/object-storage.service";
import type { ITaskQueueService } from "@/services/task-queue.service";
import { UrlUnfurlService } from "./url-unfurl.service";

if (process.env.RUN_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Integration tests require RUN_INTEGRATION_TESTS=true and a disposable database.",
  );
}

const objectStorage: IObjectStorageService = {
  bucket: "test-bucket",
  async createPresignedPutUrl() {
    return {
      url: "https://media.test/put",
      headers: {},
      expiresAt: new Date(),
    };
  },
  async createPresignedGetUrl(key) {
    return { key, url: `https://media.test/${key}`, expiresAt: new Date() };
  },
  async createPresignedGetUrls(keys) {
    return new Map(
      [...keys].map((key) => [
        key,
        { key, url: `https://media.test/${key}`, expiresAt: new Date() },
      ]),
    );
  },
  async putObject() {},
  async getObjectBytes() {
    return new Uint8Array();
  },
  async deleteObject() {},
  async deleteObjects() {},
};

const logger: ILoggerService = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

let fixture: { organizationId: string; userId: string };
let resolutionTasks: Array<{ id: number; generation: number }>;
let mediaTasks: Array<{ id: number; generation: number }>;
let service: UrlUnfurlService;
let assetService: AssetService;

beforeEach(async () => {
  const suffix = randomUUID();
  fixture = {
    organizationId: `unfurl-org-${suffix}`,
    userId: `unfurl-user-${suffix}`,
  };
  resolutionTasks = [];
  mediaTasks = [];
  const queue: ITaskQueueService = {
    async enqueueResolution(id, generation) {
      resolutionTasks.push({ id, generation });
      return true;
    },
    async enqueueResourceMedia(id, generation) {
      mediaTasks.push({ id, generation });
      return true;
    },
  };
  service = new UrlUnfurlService(queue, objectStorage, logger);
  assetService = new AssetService({
    objectStorageService: objectStorage,
    resourceLifecycle: service,
  });

  await db.insert(user).values({
    id: fixture.userId,
    name: "URL Unfurl Test User",
    email: `${fixture.userId}@example.test`,
    emailVerified: true,
  });
  await db.insert(organization).values({
    id: fixture.organizationId,
    name: "URL Unfurl Test Organization",
    slug: `unfurl-${suffix}`,
    createdAt: new Date(),
  });
});

afterEach(async () => {
  await db
    .delete(organization)
    .where(eq(organization.id, fixture.organizationId));
  await db.delete(user).where(eq(user.id, fixture.userId));
});

describe("UrlUnfurlService integration", () => {
  it("persists an optimistic collection card and reuses one resource for duplicates", async () => {
    const collection = await new CollectionService({
      objectStorageService: objectStorage,
    }).createCollection(fixture.organizationId, fixture.userId, {
      name: "Links",
    });

    const first = await service.createCollectionLink(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        url: "https://Example.com/reference?id=7#one",
        position: { x: 4, y: 8 },
      },
    );
    const duplicate = await service.createCollectionLink(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { url: "https://example.com/reference?id=7#two" },
    );

    expect(first).toMatchObject({
      type: "link",
      hostname: "example.com",
      resolutionStatus: "queued",
      position: { x: 4, y: 8 },
    });
    expect(duplicate.id).not.toBe(first.id);
    expect(resolutionTasks).toHaveLength(1);
    const [resourceCount] = await db
      .select({ value: count() })
      .from(externalResources)
      .where(eq(externalResources.organizationId, fixture.organizationId));
    expect(Number(resourceCount?.value)).toBe(1);
  });

  it("publishes metadata before media and degrades preview failure to partial", async () => {
    const link = await service.createInboxLink(
      fixture.organizationId,
      fixture.userId,
      { url: "https://example.com/article" },
    );
    const task = resolutionTasks[0]!;
    await expect(
      service.claimResolution(task.id, task.generation),
    ).resolves.toMatchObject({
      ignored: false,
    });
    await service.handleResolutionResult({
      event: "resource.metadata.completed",
      id: task.id,
      generation: task.generation,
      resolverKey: "generic-html",
      resolverVersion: "1",
      finalUrl: "https://example.com/article",
      canonicalUrl: null,
      title: "Resolved article",
      description: "Description",
      siteName: "Example",
      resourceKind: "article",
      fieldProvenance: {
        title: { resolver: "generic-html", source: "og:title" },
      },
      providerExtensions: {},
      media: [
        {
          role: "preview",
          sourceUrl: "https://cdn.example.com/preview.jpg",
          sourceMetadata: "og:image",
          processingProfile: "link-preview-v1",
        },
      ],
    });

    await expect(
      service.getLinkNode(
        fixture.organizationId,
        Number(link.id.slice("link-".length)),
        null,
      ),
    ).resolves.toMatchObject({
      title: "Resolved article",
      resolutionStatus: "resolving",
    });
    expect(mediaTasks).toHaveLength(1);
    await service.handleResourceMediaResult({
      event: "resource.media.failed",
      id: mediaTasks[0]!.id,
      generation: mediaTasks[0]!.generation,
      failureCategory: "content_type",
      diagnosticCode: "content_type",
    });
    await expect(
      service.getLinkNode(
        fixture.organizationId,
        Number(link.id.slice("link-".length)),
        null,
      ),
    ).resolves.toMatchObject({
      resolutionStatus: "partial",
      previewImage: null,
    });
  });

  it("ignores an old generation after refresh", async () => {
    const link = await service.createInboxLink(
      fixture.organizationId,
      fixture.userId,
      { url: "https://example.com/stale" },
    );
    const firstTask = resolutionTasks[0]!;
    await service.handleResolutionResult({
      event: "resource.metadata.completed",
      id: firstTask.id,
      generation: firstTask.generation,
      resolverKey: "generic-html",
      resolverVersion: "1",
      finalUrl: "https://example.com/stale",
      canonicalUrl: null,
      title: "First",
      description: null,
      siteName: "Example",
      resourceKind: "web_page",
      fieldProvenance: {},
      providerExtensions: {},
      media: [],
    });
    await service.refreshLink(fixture.organizationId, link.id);

    await expect(
      service.handleResolutionResult({
        event: "resource.metadata.failed",
        id: firstTask.id,
        generation: firstTask.generation,
        failureCategory: "timeout",
        diagnosticCode: "timeout",
      }),
    ).resolves.toEqual({ ignored: true });
    expect(resolutionTasks.at(-1)?.generation).toBe(firstTask.generation + 1);
  });

  it("never queues sensitive URLs and cancels work after the last card is deleted", async () => {
    const sensitive = await service.createInboxLink(
      fixture.organizationId,
      fixture.userId,
      { url: "https://example.com/private?access_token=secret" },
    );
    expect(sensitive).toMatchObject({
      resolutionStatus: "failed",
      failureCategory: "sensitive_query",
    });
    expect(resolutionTasks).toHaveLength(0);

    const active = await service.createInboxLink(
      fixture.organizationId,
      fixture.userId,
      { url: "https://example.com/delete-me" },
    );
    const task = resolutionTasks[0]!;
    await assetService.deleteAsset(fixture.organizationId, active.id);
    await expect(
      service.claimResolution(task.id, task.generation),
    ).resolves.toEqual({
      ignored: true,
    });
    const [attempt] = await db
      .select({ status: resourceResolutionAttempts.status })
      .from(resourceResolutionAttempts)
      .innerJoin(
        externalResources,
        eq(externalResources.id, resourceResolutionAttempts.resourceId),
      )
      .where(
        and(
          eq(resourceResolutionAttempts.id, task.id),
          eq(externalResources.organizationId, fixture.organizationId),
        ),
      );
    expect(attempt?.status).toBe("cancelled");
  });
});
