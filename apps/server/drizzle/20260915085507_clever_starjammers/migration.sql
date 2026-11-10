CREATE TYPE "canvas_arrow_head" AS ENUM('filled', 'hollow', 'chevron');--> statement-breakpoint
CREATE TYPE "canvas_arrow_routing" AS ENUM('straight', 'smooth');--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD COLUMN "head" "canvas_arrow_head" DEFAULT 'filled'::"canvas_arrow_head" NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD COLUMN "routing" "canvas_arrow_routing" DEFAULT 'straight'::"canvas_arrow_routing" NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD COLUMN "points" jsonb DEFAULT '[]' NOT NULL;