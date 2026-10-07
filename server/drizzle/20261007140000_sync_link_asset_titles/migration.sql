UPDATE "assets" AS asset
SET "title" = resource."title"
FROM "link_assets" AS link
INNER JOIN "external_resources" AS resource
  ON resource."id" = link."resource_id"
WHERE asset."id" = link."asset_id"
  AND asset."type" = 'link';
