CREATE TYPE "image_enrichment_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "variant_status" "image_enrichment_status" DEFAULT 'processing'::"image_enrichment_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "palette_status" "image_enrichment_status" DEFAULT 'processing'::"image_enrichment_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "variant_error" text;--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "palette_error" text;