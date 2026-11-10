CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
ALTER TABLE "image_colors" ADD COLUMN "organization_id" text;--> statement-breakpoint
UPDATE "image_colors" AS "ic"
SET "organization_id" = "a"."organization_id"
FROM "assets" AS "a"
WHERE "a"."id" = "ic"."asset_id";--> statement-breakpoint
ALTER TABLE "image_colors" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "image_colors" ADD CONSTRAINT "image_colors_asset_org_fkey" FOREIGN KEY ("asset_id","organization_id") REFERENCES "assets"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "image_colors_organizationId_oklab_cube_gist_idx" ON "image_colors" USING gist ("organization_id",cube(array["oklab_l", "oklab_a", "oklab_b"]));--> statement-breakpoint
DROP INDEX "image_colors_oklab_cube_gist_idx";
