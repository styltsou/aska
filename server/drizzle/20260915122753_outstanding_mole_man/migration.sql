ALTER TABLE "canvas_objects" ADD COLUMN "front_index" integer;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD COLUMN "front_index" integer;--> statement-breakpoint
CREATE INDEX "canvas_objects_front_idx" ON "canvas_objects" ("organization_id","collection_id","parent_folder_id","front_index");--> statement-breakpoint
CREATE INDEX "collection_nodes_canvas_front_idx" ON "collection_nodes" ("organization_id","collection_id","parent_folder_id","front_index");--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_front_index_range_chk" CHECK ("front_index" is null or ("front_index" >= 0 and "front_index" <= 100000));--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_front_index_range_chk" CHECK ("front_index" is null or ("front_index" >= 0 and "front_index" <= 100000));
