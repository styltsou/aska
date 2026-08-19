CREATE TYPE "resource_media_role" AS ENUM('preview', 'icon', 'primary', 'cover');--> statement-breakpoint
CREATE TYPE "resource_media_status" AS ENUM('discovered', 'queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "resource_resolution_attempt_status" AS ENUM('queued', 'processing', 'succeeded', 'failed', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TYPE "resource_resolution_status" AS ENUM('queued', 'resolving', 'partial', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "resource_resolution_trigger" AS ENUM('paste', 'manual_refresh', 'stale_revalidation', 'resolver_version');--> statement-breakpoint
ALTER TYPE "asset_type" ADD VALUE 'link';--> statement-breakpoint
CREATE TABLE "external_resource_media" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_resource_media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"resource_id" integer NOT NULL,
	"role" "resource_media_role" NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL,
	"source_url" text NOT NULL,
	"source_url_hash" varchar(64) NOT NULL,
	"source_resolver" varchar(120) NOT NULL,
	"source_metadata" varchar(120) NOT NULL,
	"processing_profile" varchar(64) NOT NULL,
	"processing_profile_version" varchar(32) DEFAULT '1' NOT NULL,
	"generation" integer NOT NULL,
	"status" "resource_media_status" DEFAULT 'discovered'::"resource_media_status" NOT NULL,
	"storage_id" text NOT NULL,
	"variants" jsonb DEFAULT '{}' NOT NULL,
	"blur_data_url" text,
	"width" integer,
	"height" integer,
	"format" varchar(32),
	"size_bytes" bigint,
	"alt" text,
	"failure_category" varchar(64),
	"enqueued_at" timestamp,
	"processing_started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_resource_media_ordinal_non_negative_chk" CHECK ("ordinal" >= 0),
	CONSTRAINT "external_resource_media_generation_positive_chk" CHECK ("generation" > 0)
);
--> statement-breakpoint
CREATE TABLE "external_resources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"normalized_url" text NOT NULL,
	"normalized_url_hash" varchar(64) NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"canonical_url" text,
	"title" varchar(255),
	"description" text,
	"site_name" varchar(255),
	"resource_kind" varchar(32) DEFAULT 'web_page' NOT NULL,
	"resolver_key" varchar(120) DEFAULT 'generic-html' NOT NULL,
	"resolver_version" varchar(64) DEFAULT '1' NOT NULL,
	"resolution_generation" integer DEFAULT 1 NOT NULL,
	"resolution_status" "resource_resolution_status" DEFAULT 'queued'::"resource_resolution_status" NOT NULL,
	"failure_category" varchar(64),
	"field_provenance" jsonb DEFAULT '{}' NOT NULL,
	"provider_extensions" jsonb DEFAULT '{}' NOT NULL,
	"resolved_at" timestamp,
	"stale_at" timestamp,
	"unreferenced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_resources_generation_positive_chk" CHECK ("resolution_generation" > 0)
);
--> statement-breakpoint
CREATE TABLE "link_assets" (
	"asset_id" integer PRIMARY KEY,
	"organization_id" text NOT NULL,
	"resource_id" integer NOT NULL,
	"original_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_resolution_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_resolution_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"resource_id" integer NOT NULL,
	"generation" integer NOT NULL,
	"trigger" "resource_resolution_trigger" NOT NULL,
	"status" "resource_resolution_attempt_status" DEFAULT 'queued'::"resource_resolution_attempt_status" NOT NULL,
	"resolver_key" varchar(120) NOT NULL,
	"resolver_version" varchar(64) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"enqueued_at" timestamp,
	"processing_started_at" timestamp,
	"finished_at" timestamp,
	"failure_category" varchar(64),
	"http_status" integer,
	"diagnostic_code" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_resolution_attempts_generation_positive_chk" CHECK ("generation" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "external_resource_media_resource_role_ordinal_uidx" ON "external_resource_media" ("resource_id","role","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "external_resource_media_storageId_uidx" ON "external_resource_media" ("storage_id");--> statement-breakpoint
CREATE INDEX "external_resource_media_status_createdAt_idx" ON "external_resource_media" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_resources_id_organizationId_uidx" ON "external_resources" ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_resources_org_urlHash_uidx" ON "external_resources" ("organization_id","normalized_url_hash");--> statement-breakpoint
CREATE INDEX "external_resources_org_status_idx" ON "external_resources" ("organization_id","resolution_status");--> statement-breakpoint
CREATE INDEX "external_resources_unreferencedAt_idx" ON "external_resources" ("unreferenced_at");--> statement-breakpoint
CREATE INDEX "link_assets_resourceId_idx" ON "link_assets" ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_resolution_attempts_resource_generation_uidx" ON "resource_resolution_attempts" ("resource_id","generation");--> statement-breakpoint
CREATE INDEX "resource_resolution_attempts_status_createdAt_idx" ON "resource_resolution_attempts" ("status","created_at");--> statement-breakpoint
ALTER TABLE "external_resource_media" ADD CONSTRAINT "external_resource_media_resource_org_fkey" FOREIGN KEY ("resource_id","organization_id") REFERENCES "external_resources"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_assets" ADD CONSTRAINT "link_assets_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_assets" ADD CONSTRAINT "link_assets_asset_org_fkey" FOREIGN KEY ("asset_id","organization_id") REFERENCES "assets"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_assets" ADD CONSTRAINT "link_assets_resource_org_fkey" FOREIGN KEY ("resource_id","organization_id") REFERENCES "external_resources"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_resolution_attempts" ADD CONSTRAINT "resource_resolution_attempts_resource_org_fkey" FOREIGN KEY ("resource_id","organization_id") REFERENCES "external_resources"("id","organization_id") ON DELETE CASCADE;