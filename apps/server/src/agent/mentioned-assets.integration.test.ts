import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  assets,
  colorAssets,
  externalResources,
  imageAssets,
  linkAssets,
  member,
  noteAssets,
  organization,
  user,
} from "@/db/schema";

import { loadMentions } from "./mentioned-assets";

if (process.env.RUN_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Integration tests require RUN_INTEGRATION_TESTS=true and a disposable database.",
  );
}

let fixture: {
  slug: string;
  otherSlug: string;
  organizationIds: [string, string];
  userId: string;
  outsiderId: string;
};

async function createAsset(
  organizationId: string,
  type: "note" | "link" | "color" | "image",
  title: string,
) {
  const [asset] = await db
    .insert(assets)
    .values({ organizationId, type, title })
    .returning({ id: assets.id });
  return asset!.id;
}

async function createNote(
  organizationId: string,
  title: string,
  markdown: string,
) {
  const id = await createAsset(organizationId, "note", title);
  await db.insert(noteAssets).values({ assetId: id, markdown });
  return id;
}

async function createLink(organizationId: string) {
  const id = await createAsset(organizationId, "link", "Launch plan");
  const [resource] = await db
    .insert(externalResources)
    .values({
      organizationId,
      normalizedUrl: `https://example.test/launch-${id}`,
      normalizedUrlHash: randomUUID().replaceAll("-", ""),
      hostname: "example.test",
      canonicalUrl: "https://example.test/launch",
      siteName: "Example",
      description: "How the launch rolls out.",
    })
    .returning({ id: externalResources.id });
  await db.insert(linkAssets).values({
    assetId: id,
    organizationId,
    resourceId: resource!.id,
    originalUrl: "https://example.test/launch?ref=x",
    note: "Read before the review",
  });
  return id;
}

async function createColor(organizationId: string) {
  const id = await createAsset(organizationId, "color", "Deep teal");
  await db.insert(colorAssets).values({ assetId: id, hex: "#0f766e" });
  return id;
}

async function createImage(organizationId: string) {
  const id = await createAsset(organizationId, "image", "Lobby chairs");
  await db.insert(imageAssets).values({
    assetId: id,
    width: 3000,
    height: 2000,
    alt: "Three teal lounge chairs",
    dominantColors: ["#0f766e"],
    variants: {
      display: {
        objectKey: `images/${id}/display.webp`,
        width: 960,
        height: 640,
        contentType: "image/webp",
        sizeBytes: 120_000,
      },
    },
  });
  return id;
}

beforeEach(async () => {
  const suffix = randomUUID();
  fixture = {
    slug: `agent-${suffix}`,
    otherSlug: `agent-other-${suffix}`,
    organizationIds: [`agent-org-${suffix}`, `agent-other-org-${suffix}`],
    userId: `agent-user-${suffix}`,
    outsiderId: `agent-outsider-${suffix}`,
  };
  await db.insert(user).values([
    {
      id: fixture.userId,
      name: "Agent Member",
      email: `${fixture.userId}@example.test`,
      emailVerified: true,
    },
    {
      id: fixture.outsiderId,
      name: "Agent Outsider",
      email: `${fixture.outsiderId}@example.test`,
      emailVerified: true,
    },
  ]);
  await db.insert(organization).values([
    {
      id: fixture.organizationIds[0],
      name: "Agent Workspace",
      slug: fixture.slug,
      createdAt: new Date(),
    },
    {
      id: fixture.organizationIds[1],
      name: "Other Workspace",
      slug: fixture.otherSlug,
      createdAt: new Date(),
    },
  ]);
  await db.insert(member).values({
    id: `agent-member-${suffix}`,
    organizationId: fixture.organizationIds[0],
    userId: fixture.userId,
    createdAt: new Date(),
  });
});

afterEach(async () => {
  for (const id of fixture.organizationIds) {
    await db.delete(organization).where(eq(organization.id, id));
  }
  await db.delete(user).where(eq(user.id, fixture.userId));
  await db.delete(user).where(eq(user.id, fixture.outsiderId));
});

describe("loadMentions", () => {
  it("returns notes, links and colors in mention order", async () => {
    const [org] = fixture.organizationIds;
    const note = await createNote(org, "Roadmap", "# Roadmap");
    const link = await createLink(org);
    const color = await createColor(org);

    const references = await loadMentions(fixture.slug, fixture.userId, [
      { assetId: color, type: "color" },
      { assetId: note, type: "note" },
      { assetId: link, type: "link" },
    ]);

    expect(references.map(({ kind, title }) => [kind, title])).toEqual([
      ["color", "Deep teal"],
      ["note", "Roadmap"],
      ["link", "Launch plan"],
    ]);
    expect(references[0]!.text).toContain("Value: #0f766e");
    expect(references[1]!.text).toBe("# Roadmap");
    expect(references[2]!.text).toContain("URL: https://example.test/launch");
    expect(references[2]!.text).toContain(
      "Description: How the launch rolls out.",
    );
    expect(references[2]!.text).toContain(
      "User's note: Read before the review",
    );
  });

  it("describes a mentioned image and attaches its display variant", async () => {
    const image = await createImage(fixture.organizationIds[0]);
    const fetched: string[] = [];

    const [reference] = await loadMentions(
      fixture.slug,
      fixture.userId,
      [{ assetId: image, type: "image" }],
      {
        fetchObject: async (key) => {
          fetched.push(key);
          return new Uint8Array([1, 2, 3]);
        },
      },
    );

    expect(fetched).toEqual([`images/${image}/display.webp`]);
    expect(reference).toMatchObject({
      kind: "image",
      title: "Lobby chairs",
      image: { mimeType: "image/webp", data: "AQID" },
    });
    expect(reference!.text).toContain("Alt text: Three teal lounge chairs");
  });

  it("skips a mention whose type doesn't match the asset", async () => {
    const color = await createColor(fixture.organizationIds[0]);

    expect(
      await loadMentions(fixture.slug, fixture.userId, [
        { assetId: color, type: "note" },
      ]),
    ).toEqual([]);
  });

  it("leaves out items from other workspaces", async () => {
    const own = await createNote(fixture.organizationIds[0], "Own", "own");
    const foreign = await createNote(
      fixture.organizationIds[1],
      "Foreign",
      "secret",
    );

    expect(
      await loadMentions(fixture.slug, fixture.userId, [
        { assetId: own, type: "note" },
        { assetId: foreign, type: "note" },
      ]),
    ).toEqual([{ kind: "note", title: "Own", text: "own" }]);
    // Naming the other workspace doesn't help: the user isn't a member.
    expect(
      await loadMentions(fixture.otherSlug, fixture.userId, [
        { assetId: foreign, type: "note" },
      ]),
    ).toEqual([]);
  });

  it("returns nothing to a user outside the workspace", async () => {
    const note = await createNote(fixture.organizationIds[0], "Note", "text");

    expect(
      await loadMentions(fixture.slug, fixture.outsiderId, [
        { assetId: note, type: "note" },
      ]),
    ).toEqual([]);
  });
});
