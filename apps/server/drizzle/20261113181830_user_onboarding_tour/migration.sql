CREATE TABLE "user_onboarding_tour" (
	"user_id" text,
	"tour_key" text,
	"status" text NOT NULL,
	"step" text,
	"workspace_slug" text,
	"collection_slug" text,
	"note_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_onboarding_tour_pkey" PRIMARY KEY("user_id","tour_key")
);
--> statement-breakpoint
ALTER TABLE "user_onboarding_tour" ADD CONSTRAINT "user_onboarding_tour_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- Accounts that predate this tour should not receive first-time onboarding.
INSERT INTO "user_onboarding_tour" ("user_id", "tour_key", "status")
SELECT "id", 'getting-started-v1', 'ineligible' FROM "user";
