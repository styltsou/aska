import { z } from "zod";

const slug = z.string().min(1).max(255);
const noteId = z.string().min(1).max(255);

export const OnboardingTourEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("collection-created"),
    workspaceSlug: slug,
    collectionSlug: slug,
  }),
  z.object({
    type: z.literal("note-created"),
    workspaceSlug: slug,
    collectionSlug: slug,
    noteId,
  }),
  z.object({
    type: z.literal("note-moved"),
    workspaceSlug: slug,
    collectionSlug: slug,
    noteId,
  }),
  z.object({ type: z.literal("skip") }),
  z.object({ type: z.literal("restart") }),
]);
