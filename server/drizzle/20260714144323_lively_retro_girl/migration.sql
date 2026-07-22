CREATE TYPE "asset_type" AS ENUM('image', 'note');--> statement-breakpoint
CREATE TYPE "collection_node_type" AS ENUM('asset', 'folder');--> statement-breakpoint
CREATE TYPE "upload_source" AS ENUM('direct', 'remote_url');--> statement-breakpoint
CREATE TYPE "upload_status" AS ENUM('pending', 'uploaded', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"title" varchar(255),
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_nodes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_nodes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"collection_id" integer NOT NULL,
	"parent_folder_id" integer,
	"node_type" "collection_node_type" NOT NULL,
	"asset_id" integer,
	"folder_id" integer,
	"position_x" integer,
	"position_y" integer,
	"depth" integer DEFAULT 0 NOT NULL,
	"path_folder_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"path_folder_slugs" text[] DEFAULT '{}'::text[] NOT NULL,
	"path_folder_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_nodes_target_matches_node_type_chk" CHECK (
        (
          "node_type" = 'asset'
          and "asset_id" is not null
          and "folder_id" is null
        )
        or
        (
          "node_type" = 'folder'
          and "folder_id" is not null
          and "asset_id" is null
        )
      ),
	CONSTRAINT "collection_nodes_depth_non_negative_chk" CHECK ("depth" >= 0),
	CONSTRAINT "collection_nodes_position_pair_chk" CHECK (("position_x" is null and "position_y" is null) or ("position_x" is not null and "position_y" is not null and "position_x" >= 0 and "position_y" >= 0))
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "folders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"asset_id" integer PRIMARY KEY,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text,
	"source_label" varchar(120),
	"source_url" text,
	"variants" jsonb DEFAULT '{}' NOT NULL,
	"blur_data_url" text,
	"dominant_colors" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "image_assets_width_positive_chk" CHECK ("width" > 0),
	CONSTRAINT "image_assets_height_positive_chk" CHECK ("height" > 0)
);
--> statement-breakpoint
CREATE TABLE "image_colors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "image_colors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_id" integer NOT NULL,
	"hex" varchar(7) NOT NULL,
	"oklab_l" double precision NOT NULL,
	"oklab_a" double precision NOT NULL,
	"oklab_b" double precision NOT NULL,
	"coverage" double precision NOT NULL,
	"salience" double precision NOT NULL,
	"is_accent" boolean DEFAULT false NOT NULL,
	"extraction_version" integer NOT NULL,
	CONSTRAINT "image_colors_coverage_range_chk" CHECK ("coverage" >= 0 AND "coverage" <= 1),
	CONSTRAINT "image_colors_salience_range_chk" CHECK ("salience" >= 0 AND "salience" <= 1)
);
--> statement-breakpoint
CREATE TABLE "note_assets" (
	"asset_id" integer PRIMARY KEY,
	"markdown" text NOT NULL,
	"color" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "uploads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"collection_id" integer,
	"parent_folder_path" text,
	"position_x" integer,
	"position_y" integer,
	"source" "upload_source" NOT NULL,
	"status" "upload_status" DEFAULT 'pending'::"upload_status" NOT NULL,
	"original_object_key" text NOT NULL,
	"storage_id" text NOT NULL,
	"asset_id" integer,
	"file_name" varchar(255),
	"title" varchar(255),
	"alt" text,
	"source_label" varchar(120),
	"source_url" text,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"upload_url_expires_at" timestamp,
	"error_message" text,
	"processing_etag" varchar(255),
	"created_by_user_id" text,
	"finalized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_sizeBytes_positive_chk" CHECK ("size_bytes" > 0),
	CONSTRAINT "uploads_position_pair_chk" CHECK (("position_x" is null and "position_y" is null) or ("position_x" is not null and "position_y" is not null and "position_x" >= 0 and "position_y" >= 0))
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"reference_id" text NOT NULL,
	"prefix" text,
	"key" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE INDEX "assets_organizationId_idx" ON "assets" ("organization_id");--> statement-breakpoint
CREATE INDEX "assets_type_idx" ON "assets" ("type");--> statement-breakpoint
CREATE INDEX "assets_createdAt_idx" ON "assets" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_id_organizationId_uidx" ON "assets" ("id","organization_id");--> statement-breakpoint
CREATE INDEX "collection_nodes_assetId_idx" ON "collection_nodes" ("asset_id");--> statement-breakpoint
CREATE INDEX "collection_nodes_collectionId_nodeType_idx" ON "collection_nodes" ("collection_id","node_type");--> statement-breakpoint
CREATE INDEX "collection_nodes_pathFolderIds_gin_idx" ON "collection_nodes" USING gin ("path_folder_ids");--> statement-breakpoint
CREATE INDEX "collection_nodes_pathFolderSlugs_gin_idx" ON "collection_nodes" USING gin ("path_folder_slugs");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_nodes_collectionId_assetId_uidx" ON "collection_nodes" ("collection_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_nodes_folderId_uidx" ON "collection_nodes" ("folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_nodes_collectionId_folderId_uidx" ON "collection_nodes" ("collection_id","folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_nodes_collectionId_folderPathSlugs_uidx" ON "collection_nodes" ("collection_id","path_folder_slugs") WHERE "node_type" = 'folder';--> statement-breakpoint
CREATE INDEX "collections_organizationId_idx" ON "collections" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_id_organizationId_uidx" ON "collections" ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_organizationId_slug_uidx" ON "collections" ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "folders_organizationId_idx" ON "folders" ("organization_id");--> statement-breakpoint
CREATE INDEX "folders_slug_idx" ON "folders" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_id_organizationId_uidx" ON "folders" ("id","organization_id");--> statement-breakpoint
CREATE INDEX "image_colors_assetId_idx" ON "image_colors" ("asset_id");--> statement-breakpoint
CREATE INDEX "image_colors_oklab_idx" ON "image_colors" ("oklab_l","oklab_a","oklab_b");--> statement-breakpoint
CREATE INDEX "image_colors_oklab_cube_gist_idx" ON "image_colors" USING gist (cube(array["oklab_l", "oklab_a", "oklab_b"]));--> statement-breakpoint
CREATE INDEX "uploads_organizationId_idx" ON "uploads" ("organization_id");--> statement-breakpoint
CREATE INDEX "uploads_status_idx" ON "uploads" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_originalObjectKey_uidx" ON "uploads" ("original_object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_storageId_uidx" ON "uploads" ("storage_id");--> statement-breakpoint
CREATE INDEX "uploads_assetId_idx" ON "uploads" ("asset_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "apikey_configId_idx" ON "apikey" ("config_id");--> statement-breakpoint
CREATE INDEX "apikey_referenceId_idx" ON "apikey" ("reference_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" ("key");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_updated_by_user_id_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_collection_org_fkey" FOREIGN KEY ("collection_id","organization_id") REFERENCES "collections"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_asset_org_fkey" FOREIGN KEY ("asset_id","organization_id") REFERENCES "assets"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_folder_org_fkey" FOREIGN KEY ("folder_id","organization_id") REFERENCES "folders"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_parent_folder_in_collection_fkey" FOREIGN KEY ("collection_id","parent_folder_id") REFERENCES "collection_nodes"("collection_id","folder_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_updated_by_user_id_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_updated_by_user_id_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "image_colors" ADD CONSTRAINT "image_colors_asset_id_image_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_assets"("asset_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_assets" ADD CONSTRAINT "note_assets_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;