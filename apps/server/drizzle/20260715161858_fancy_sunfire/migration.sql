DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "collection_nodes"
		WHERE "node_type" = 'asset'
		GROUP BY "asset_id"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot enforce one placement per asset: duplicate collection_nodes.asset_id rows exist';
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_nodes_assetId_uidx" ON "collection_nodes" ("asset_id");
