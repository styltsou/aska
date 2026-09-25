DROP TABLE "diagram_assets";--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "note_references" DROP CONSTRAINT "note_references_target_type_chk";--> statement-breakpoint
ALTER TABLE "note_references" ALTER COLUMN "target_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "asset_type";--> statement-breakpoint
CREATE TYPE "asset_type" AS ENUM('image', 'note', 'link', 'color');--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "type" SET DATA TYPE "asset_type" USING "type"::"asset_type";--> statement-breakpoint
ALTER TABLE "note_references" ALTER COLUMN "target_type" SET DATA TYPE "asset_type" USING "target_type"::"asset_type";--> statement-breakpoint
ALTER TABLE "note_references" ADD CONSTRAINT "note_references_target_type_chk" CHECK ("target_type" in ('note', 'color'));