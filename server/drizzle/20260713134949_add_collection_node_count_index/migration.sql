-- Custom SQL migration file, put your code below! --
CREATE INDEX "collection_nodes_collectionId_nodeType_idx" ON "collection_nodes" USING btree ("collection_id", "node_type");
