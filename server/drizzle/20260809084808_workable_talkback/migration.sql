CREATE TABLE "image_edit_actions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "image_edit_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"asset_id" integer NOT NULL,
	"action_type" varchar(32) NOT NULL,
	"params" jsonb NOT NULL,
	"result_width" integer,
	"result_height" integer,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"undone_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "image_edit_actions_assetId_createdAt_idx" ON "image_edit_actions" ("asset_id","created_at");--> statement-breakpoint
ALTER TABLE "image_edit_actions" ADD CONSTRAINT "image_edit_actions_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "image_edit_actions" ADD CONSTRAINT "image_edit_actions_asset_id_image_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_assets"("asset_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "image_edit_actions" ADD CONSTRAINT "image_edit_actions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;