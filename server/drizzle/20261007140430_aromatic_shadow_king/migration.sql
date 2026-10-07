ALTER TABLE "color_assets" ALTER COLUMN "hex" DROP NOT NULL;--> statement-breakpoint
UPDATE "color_assets" SET "hex" = NULL WHERE "gradient" IS NOT NULL;--> statement-breakpoint
UPDATE "assets" AS asset
SET "title" = CASE
  WHEN color."gradient"->>'type' = 'radial' THEN 'Radial Gradient'
  ELSE 'Linear Gradient'
END
FROM "color_assets" AS color
WHERE asset."id" = color."asset_id"
  AND color."gradient" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "color_assets" ADD CONSTRAINT "color_assets_hex_gradient_consistency_chk" CHECK (("gradient" IS NULL AND "hex" IS NOT NULL) OR ("gradient" IS NOT NULL AND "hex" IS NULL));
