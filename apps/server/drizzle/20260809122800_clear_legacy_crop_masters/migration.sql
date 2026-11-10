-- The action-log crop model kept a `master` object in variants. The replacement
-- model has no history, so retain the active current render and enqueue only
-- that now-unreferenced source for the normal retryable S3 cleanup path.
INSERT INTO "media_cleanup_jobs" ("organization_id", "asset_id", "object_keys")
SELECT
  "assets"."organization_id",
  "image_assets"."asset_id",
  ARRAY["image_assets"."variants"->'master'->>'objectKey']
FROM "image_assets"
INNER JOIN "assets" ON "assets"."id" = "image_assets"."asset_id"
WHERE "image_assets"."variants" ? 'master'
  AND "image_assets"."variants"->'master'->>'objectKey' IS NOT NULL;
--> statement-breakpoint
UPDATE "image_assets"
SET "variants" = "variants" - 'master'
WHERE "variants" ? 'master';
