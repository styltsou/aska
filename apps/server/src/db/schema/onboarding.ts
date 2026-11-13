import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userOnboardingTour = pgTable(
  "user_onboarding_tour",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tourKey: text("tour_key").notNull(),
    status: text("status").notNull(),
    step: text("step"),
    workspaceSlug: text("workspace_slug"),
    collectionSlug: text("collection_slug"),
    noteId: text("note_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tourKey] })],
);
