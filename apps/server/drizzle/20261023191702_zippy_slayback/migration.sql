ALTER TABLE "color_assets" ADD COLUMN "name_edited_by_user" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "color_assets" ADD COLUMN "name_basis" jsonb;--> statement-breakpoint
