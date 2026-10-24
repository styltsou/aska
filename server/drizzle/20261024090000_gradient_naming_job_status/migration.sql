ALTER TABLE "color_assets" ADD COLUMN "name_job_fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "color_assets" ADD COLUMN "name_job_status" varchar(16);--> statement-breakpoint
ALTER TABLE "color_assets" ADD COLUMN "name_job_error" varchar(32);
