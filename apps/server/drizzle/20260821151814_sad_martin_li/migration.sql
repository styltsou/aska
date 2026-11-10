ALTER TYPE "asset_type" ADD VALUE 'color';--> statement-breakpoint
CREATE TABLE "color_assets" (
	"asset_id" integer PRIMARY KEY,
	"hex" varchar(9) NOT NULL,
	CONSTRAINT "color_assets_hex_format_chk" CHECK ("hex" ~ '^#[0-9a-f]{6}([0-9a-f]{2})?$')
);
--> statement-breakpoint
ALTER TABLE "color_assets" ADD CONSTRAINT "color_assets_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;