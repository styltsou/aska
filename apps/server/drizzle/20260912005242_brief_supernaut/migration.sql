CREATE INDEX "assets_organizationId_type_updatedAt_idx" ON "assets" ("organization_id","type","updated_at");
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "assets_title_trgm_idx" ON "assets" USING gin ("title" gin_trgm_ops) WHERE "title" IS NOT NULL;
