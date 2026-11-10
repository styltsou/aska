CREATE TYPE "canvas_arrow_pattern" AS ENUM('solid', 'dashed', 'dotted');--> statement-breakpoint
CREATE TYPE "canvas_arrow_style" AS ENUM('clean', 'sketch');--> statement-breakpoint
CREATE TYPE "canvas_object_color" AS ENUM('ink', 'cobalt', 'coral', 'moss', 'ochre');--> statement-breakpoint
CREATE TYPE "canvas_object_type" AS ENUM('text', 'arrow');--> statement-breakpoint
CREATE TYPE "canvas_text_font" AS ENUM('inter', 'newsreader', 'caveat');--> statement-breakpoint
CREATE TYPE "canvas_text_size" AS ENUM('sm', 'md', 'lg', 'xl');--> statement-breakpoint
CREATE TABLE "canvas_arrow_objects" (
	"canvas_object_id" integer PRIMARY KEY,
	"start_x" integer NOT NULL,
	"start_y" integer NOT NULL,
	"end_x" integer NOT NULL,
	"end_y" integer NOT NULL,
	"start_collection_node_id" integer,
	"start_canvas_object_id" integer,
	"start_anchor_x" double precision,
	"start_anchor_y" double precision,
	"end_collection_node_id" integer,
	"end_canvas_object_id" integer,
	"end_anchor_x" double precision,
	"end_anchor_y" double precision,
	"style" "canvas_arrow_style" DEFAULT 'clean'::"canvas_arrow_style" NOT NULL,
	"pattern" "canvas_arrow_pattern" DEFAULT 'solid'::"canvas_arrow_pattern" NOT NULL,
	"color" "canvas_object_color" DEFAULT 'ink'::"canvas_object_color" NOT NULL,
	CONSTRAINT "canvas_arrow_start_single_target_chk" CHECK (not ("start_collection_node_id" is not null and "start_canvas_object_id" is not null)),
	CONSTRAINT "canvas_arrow_end_single_target_chk" CHECK (not ("end_collection_node_id" is not null and "end_canvas_object_id" is not null)),
	CONSTRAINT "canvas_arrow_start_anchor_pair_chk" CHECK (("start_anchor_x" is null) = ("start_anchor_y" is null)),
	CONSTRAINT "canvas_arrow_end_anchor_pair_chk" CHECK (("end_anchor_x" is null) = ("end_anchor_y" is null))
);
--> statement-breakpoint
CREATE TABLE "canvas_objects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "canvas_objects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"collection_id" integer NOT NULL,
	"parent_folder_id" integer,
	"object_type" "canvas_object_type" NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_text_objects" (
	"canvas_object_id" integer PRIMARY KEY,
	"content" text NOT NULL,
	"position_x" integer NOT NULL,
	"position_y" integer NOT NULL,
	"font" "canvas_text_font" DEFAULT 'inter'::"canvas_text_font" NOT NULL,
	"size" "canvas_text_size" DEFAULT 'md'::"canvas_text_size" NOT NULL,
	"color" "canvas_object_color" DEFAULT 'ink'::"canvas_object_color" NOT NULL,
	CONSTRAINT "canvas_text_objects_content_not_blank_chk" CHECK (length(btrim("content")) > 0)
);
--> statement-breakpoint
CREATE INDEX "canvas_objects_scope_idx" ON "canvas_objects" ("organization_id","collection_id","parent_folder_id");--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD CONSTRAINT "canvas_arrow_objects_canvas_object_id_canvas_objects_id_fkey" FOREIGN KEY ("canvas_object_id") REFERENCES "canvas_objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD CONSTRAINT "canvas_arrow_objects_C1T9I3Rr5TcZ_fkey" FOREIGN KEY ("start_collection_node_id") REFERENCES "collection_nodes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD CONSTRAINT "canvas_arrow_objects_ZqGzRD235Caz_fkey" FOREIGN KEY ("start_canvas_object_id") REFERENCES "canvas_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD CONSTRAINT "canvas_arrow_objects_PZmJwQjghjFA_fkey" FOREIGN KEY ("end_collection_node_id") REFERENCES "collection_nodes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "canvas_arrow_objects" ADD CONSTRAINT "canvas_arrow_objects_oafVLxUK9Gb2_fkey" FOREIGN KEY ("end_canvas_object_id") REFERENCES "canvas_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_updated_by_user_id_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_collection_org_fkey" FOREIGN KEY ("collection_id","organization_id") REFERENCES "collections"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_parent_folder_in_collection_fkey" FOREIGN KEY ("collection_id","parent_folder_id") REFERENCES "collection_nodes"("collection_id","folder_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "canvas_text_objects" ADD CONSTRAINT "canvas_text_objects_canvas_object_id_canvas_objects_id_fkey" FOREIGN KEY ("canvas_object_id") REFERENCES "canvas_objects"("id") ON DELETE CASCADE;