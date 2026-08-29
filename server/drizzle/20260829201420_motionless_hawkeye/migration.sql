CREATE TABLE "note_references" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "note_references_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"source_asset_id" integer NOT NULL,
	"target_asset_id" integer NOT NULL,
	"target_type" "asset_type" NOT NULL,
	"fallback_label" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "note_references_target_type_chk" CHECK ("target_type" in ('note', 'color')),
	CONSTRAINT "note_references_no_self_reference_chk" CHECK ("source_asset_id" <> "target_asset_id")
);
--> statement-breakpoint
CREATE INDEX "note_references_organizationId_idx" ON "note_references" ("organization_id");--> statement-breakpoint
CREATE INDEX "note_references_sourceAssetId_idx" ON "note_references" ("source_asset_id");--> statement-breakpoint
CREATE INDEX "note_references_targetAssetId_idx" ON "note_references" ("target_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "note_references_source_target_uidx" ON "note_references" ("source_asset_id","target_asset_id");--> statement-breakpoint
ALTER TABLE "note_references" ADD CONSTRAINT "note_references_source_asset_org_fkey" FOREIGN KEY ("source_asset_id","organization_id") REFERENCES "assets"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_references" ADD CONSTRAINT "note_references_target_asset_org_fkey" FOREIGN KEY ("target_asset_id","organization_id") REFERENCES "assets"("id","organization_id") ON DELETE CASCADE;