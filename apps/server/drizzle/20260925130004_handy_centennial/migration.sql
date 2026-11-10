ALTER TYPE "asset_type" ADD VALUE 'diagram';--> statement-breakpoint
CREATE TABLE "diagram_assets" (
	"asset_id" integer PRIMARY KEY,
	"source" text NOT NULL,
	"frame_width" integer DEFAULT 480 NOT NULL,
	"frame_height" integer DEFAULT 320 NOT NULL,
	CONSTRAINT "diagram_assets_source_length_chk" CHECK (length("source") BETWEEN 1 AND 50000),
	CONSTRAINT "diagram_assets_width_chk" CHECK ("frame_width" BETWEEN 280 AND 1200),
	CONSTRAINT "diagram_assets_height_chk" CHECK ("frame_height" BETWEEN 180 AND 900)
);
--> statement-breakpoint
ALTER TABLE "diagram_assets" ADD CONSTRAINT "diagram_assets_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;
