CREATE TYPE "media_cleanup_job_status" AS ENUM('pending', 'processing');--> statement-breakpoint
CREATE TABLE "media_cleanup_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_cleanup_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"asset_id" integer,
	"object_keys" text[] NOT NULL,
	"status" "media_cleanup_job_status" DEFAULT 'pending'::"media_cleanup_job_status" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "media_cleanup_jobs_status_nextAttemptAt_idx" ON "media_cleanup_jobs" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "media_cleanup_jobs_assetId_idx" ON "media_cleanup_jobs" ("asset_id");--> statement-breakpoint
ALTER TABLE "media_cleanup_jobs" ADD CONSTRAINT "media_cleanup_jobs_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "media_cleanup_jobs" ADD CONSTRAINT "media_cleanup_jobs_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL;