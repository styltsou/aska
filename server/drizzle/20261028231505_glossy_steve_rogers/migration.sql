CREATE INDEX "collection_nodes_grid_page_idx" ON "collection_nodes" ("collection_id","parent_folder_id","node_type","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
