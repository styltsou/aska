ALTER TABLE "assets" ADD COLUMN "last_added_to_inbox_at" timestamp;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "inbox_last_seen_at" timestamp;--> statement-breakpoint
UPDATE "assets"
SET "last_added_to_inbox_at" = "created_at";--> statement-breakpoint
CREATE INDEX "assets_organizationId_lastAddedToInboxAt_idx" ON "assets" ("organization_id","last_added_to_inbox_at");
