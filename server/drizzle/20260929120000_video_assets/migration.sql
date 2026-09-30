ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'video';

CREATE TABLE "video_assets" (
  "asset_id" integer PRIMARY KEY NOT NULL,
  "original" jsonb,
  "poster" jsonb,
  "width" integer,
  "height" integer,
  "duration_seconds" double precision,
  "note" text,
  "source_label" varchar(120),
  "source_url" text,
  "processing_status" "image_enrichment_status" DEFAULT 'processing' NOT NULL,
  "processing_error" text,
  CONSTRAINT "video_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "video_assets_dimensions_positive_chk" CHECK (("width" is null and "height" is null) or ("width" > 0 and "height" > 0)),
  CONSTRAINT "video_assets_duration_positive_chk" CHECK ("duration_seconds" is null or "duration_seconds" > 0)
);

CREATE TABLE "video_uploads" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "collection_id" integer REFERENCES "public"."collections"("id") ON DELETE cascade,
  "parent_folder_path" text,
  "position_x" integer,
  "position_y" integer,
  "source" "upload_source" NOT NULL,
  "status" "upload_status" DEFAULT 'pending' NOT NULL,
  "original_object_key" text,
  "storage_id" text NOT NULL,
  "asset_id" integer REFERENCES "public"."assets"("id") ON DELETE set null,
  "file_name" varchar(255) NOT NULL,
  "title" varchar(255),
  "source_url" text,
  "content_type" varchar(255),
  "size_bytes" bigint,
  "processing_etag" text,
  "upload_url_expires_at" timestamp,
  "error_message" text,
  "created_by_user_id" text REFERENCES "public"."user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "video_uploads_sizeBytes_positive_chk" CHECK ("size_bytes" is null or "size_bytes" > 0),
  CONSTRAINT "video_uploads_position_pair_chk" CHECK (("position_x" is null and "position_y" is null) or ("position_x" is not null and "position_y" is not null))
);

CREATE UNIQUE INDEX "video_uploads_originalObjectKey_uidx" ON "video_uploads" USING btree ("original_object_key");
CREATE UNIQUE INDEX "video_uploads_storageId_uidx" ON "video_uploads" USING btree ("storage_id");
CREATE INDEX "video_uploads_status_idx" ON "video_uploads" USING btree ("status");
