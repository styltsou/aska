import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { colorAssets, organization, user } from "@/db/schema";
import { AssetService } from "@/services/asset.service";
import type { IObjectStorageService } from "@/services/object-storage.service";

import { fetchMentionColorsBySource } from "./mention-colors";

if (process.env.RUN_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Integration tests require RUN_INTEGRATION_TESTS=true and a disposable database.",
  );
}

const objectStorageService: IObjectStorageService = {
  bucket: "test-bucket",
  async createPresignedPutUrl() {
    return {
      url: "https://example.test/upload",
      headers: {},
      expiresAt: new Date(),
    };
  },
  async createPresignedGetUrl(key) {
    return { key, url: `https://example.test/${key}`, expiresAt: new Date() };
  },
  async createPresignedGetUrls(keys) {
    return new Map(
      [...keys].map((key) => [
        key,
        { key, url: `https://example.test/${key}`, expiresAt: new Date() },
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

const assetService = new AssetService({ objectStorageService });

let fixture: { organizationId: string; userId: string };

beforeEach(async () => {
  const suffix = randomUUID();
  fixture = {
    organizationId: `mention-org-${suffix}`,
    userId: `mention-user-${suffix}`,
  };
  await db.insert(user).values({
    id: fixture.userId,
    name: "Mention Integration User",
    email: `${fixture.userId}@example.test`,
    emailVerified: true,
  });
  await db.insert(organization).values({
    id: fixture.organizationId,
    name: "Mention Integration Organization",
    slug: `mention-${suffix}`,
    createdAt: new Date(),
  });
});

afterEach(async () => {
  await db
    .delete(organization)
    .where(eq(organization.id, fixture.organizationId));
  await db.delete(user).where(eq(user.id, fixture.userId));
});

async function noteIdOf(assetNodeId: string) {
  return Number(assetNodeId.replace(/^note-/, ""));
}

describe("fetchMentionColorsBySource", () => {
  it("resolves a referenced color to its title and hex", async () => {
    const color = await assetService.createInboxColor(
      fixture.organizationId,
      fixture.userId,
      { hex: "#0a5" },
    );
    const colorId = Number(color.id.replace(/^color-/, ""));
    const note = await assetService.createInboxNote(
      fixture.organizationId,
      fixture.userId,
      { content: `Use [Ocean](color:${colorId}).` },
    );

    const map = await fetchMentionColorsBySource(fixture.organizationId, [
      await noteIdOf(note.id),
    ]);

    expect(map.get(await noteIdOf(note.id))?.[`color:${colorId}`]).toEqual({
      hex: "#0a5",
      label: color.title,
    });
  });

  it("omits note targets, which need no color", async () => {
    const target = await assetService.createInboxNote(
      fixture.organizationId,
      fixture.userId,
      { content: "Referenced note" },
    );
    const source = await assetService.createInboxNote(
      fixture.organizationId,
      fixture.userId,
      { content: `See [Other](note:${await noteIdOf(target.id)}).` },
    );

    const map = await fetchMentionColorsBySource(fixture.organizationId, [
      await noteIdOf(source.id),
    ]);

    expect(map.get(await noteIdOf(source.id))).toEqual({});
  });

  it("returns the stored gradient for a gradient color", async () => {
    const color = await assetService.createInboxColor(
      fixture.organizationId,
      fixture.userId,
      {
        hex: "#ff0000",
        gradient: { from: "#ff0000", to: "#0000ff", angle: 120 },
      },
    );
    const colorId = Number(color.id.replace(/^color-/, ""));
    const note = await assetService.createInboxNote(
      fixture.organizationId,
      fixture.userId,
      { content: `Use [Dusk](color:${colorId}).` },
    );

    const map = await fetchMentionColorsBySource(fixture.organizationId, [
      await noteIdOf(note.id),
    ]);
    const entry = map.get(await noteIdOf(note.id))?.[`color:${colorId}`];

    expect(entry?.label).toBe(color.title);
    expect(entry?.hex).toBeUndefined();
    expect(entry?.gradient).toMatchObject({
      from: "#ff0000",
      to: "#0000ff",
      angle: 120,
    });
  });

  it("does not leak colors across organizations", async () => {
    const otherSuffix = randomUUID();
    const otherOrgId = `mention-other-org-${otherSuffix}`;
    const otherUserId = `mention-other-user-${otherSuffix}`;
    await db.insert(user).values({
      id: otherUserId,
      name: "Other User",
      email: `${otherUserId}@example.test`,
      emailVerified: true,
    });
    await db.insert(organization).values({
      id: otherOrgId,
      name: "Other Org",
      slug: `mention-other-${otherSuffix}`,
      createdAt: new Date(),
    });

    try {
      const color = await assetService.createInboxColor(
        otherOrgId,
        otherUserId,
        { hex: "#123456" },
      );
      const colorId = Number(color.id.replace(/^color-/, ""));
      const source = await assetService.createInboxNote(
        otherOrgId,
        otherUserId,
        { content: `Use [Foreign](color:${colorId}).` },
      );

      const map = await fetchMentionColorsBySource(fixture.organizationId, [
        await noteIdOf(source.id),
      ]);

      expect(map.size).toBe(0);
    } finally {
      await db.delete(organization).where(eq(organization.id, otherOrgId));
      await db.delete(user).where(eq(user.id, otherUserId));
    }
  });

  it("returns an empty map when a referenced color was deleted", async () => {
    const color = await assetService.createInboxColor(
      fixture.organizationId,
      fixture.userId,
      { hex: "#abc" },
    );
    const colorId = Number(color.id.replace(/^color-/, ""));
    const note = await assetService.createInboxNote(
      fixture.organizationId,
      fixture.userId,
      { content: `Use [Gone](color:${colorId}).` },
    );

    await db.delete(colorAssets).where(eq(colorAssets.assetId, colorId));

    const map = await fetchMentionColorsBySource(fixture.organizationId, [
      await noteIdOf(note.id),
    ]);

    expect(map.get(await noteIdOf(note.id))).toEqual({});
  });

  it("skips the query entirely when no note ids are supplied", async () => {
    expect(
      await fetchMentionColorsBySource(fixture.organizationId, []),
    ).toEqual(new Map());
    expect(
      await fetchMentionColorsBySource(fixture.organizationId, [
        null,
        undefined,
      ]),
    ).toEqual(new Map());
  });
});
