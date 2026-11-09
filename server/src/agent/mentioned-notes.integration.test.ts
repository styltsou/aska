import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { assets, member, noteAssets, organization, user } from "@/db/schema";

import { loadMentionedNotes } from "./mentioned-notes";

if (process.env.RUN_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Integration tests require RUN_INTEGRATION_TESTS=true and a disposable database.",
  );
}

let fixture: {
  slug: string;
  otherSlug: string;
  organizationIds: string[];
  userId: string;
  outsiderId: string;
};

async function createNote(
  organizationId: string,
  title: string,
  markdown: string,
) {
  const [asset] = await db
    .insert(assets)
    .values({ organizationId, type: "note", title })
    .returning({ id: assets.id });
  await db.insert(noteAssets).values({ assetId: asset!.id, markdown });
  return asset!.id;
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
      id: fixture.organizationIds[0]!,
      name: "Agent Workspace",
      slug: fixture.slug,
      createdAt: new Date(),
    },
    {
      id: fixture.organizationIds[1]!,
      name: "Other Workspace",
      slug: fixture.otherSlug,
      createdAt: new Date(),
    },
  ]);
  await db.insert(member).values({
    id: `agent-member-${suffix}`,
    organizationId: fixture.organizationIds[0]!,
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

describe("loadMentionedNotes", () => {
  it("returns the member's notes in mention order", async () => {
    const roadmap = await createNote(
      fixture.organizationIds[0]!,
      "Roadmap",
      "# Roadmap",
    );
    const team = await createNote(
      fixture.organizationIds[0]!,
      "Team",
      "# Team",
    );

    expect(
      await loadMentionedNotes(fixture.slug, fixture.userId, [team, roadmap]),
    ).toEqual([
      { title: "Team", markdown: "# Team" },
      { title: "Roadmap", markdown: "# Roadmap" },
    ]);
  });

  it("leaves out notes from other workspaces", async () => {
    const own = await createNote(fixture.organizationIds[0]!, "Own", "own");
    const foreign = await createNote(
      fixture.organizationIds[1]!,
      "Foreign",
      "secret",
    );

    expect(
      await loadMentionedNotes(fixture.slug, fixture.userId, [own, foreign]),
    ).toEqual([{ title: "Own", markdown: "own" }]);
    // Naming the other workspace doesn't help: the user isn't a member.
    expect(
      await loadMentionedNotes(fixture.otherSlug, fixture.userId, [foreign]),
    ).toEqual([]);
  });

  it("returns nothing to a user outside the workspace", async () => {
    const note = await createNote(fixture.organizationIds[0]!, "Note", "text");

    expect(
      await loadMentionedNotes(fixture.slug, fixture.outsiderId, [note]),
    ).toEqual([]);
  });
});
