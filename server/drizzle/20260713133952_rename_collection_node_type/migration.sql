-- Custom SQL migration file, put your code below! --
ALTER TYPE "collection_node_kind" RENAME TO "collection_node_type";--> statement-breakpoint
ALTER TABLE "collection_nodes" RENAME COLUMN "kind" TO "node_type";--> statement-breakpoint
ALTER TABLE "collection_nodes" RENAME CONSTRAINT "collection_nodes_target_matches_kind_chk" TO "collection_nodes_target_matches_node_type_chk";
