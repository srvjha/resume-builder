ALTER TABLE "user_ai_keys" ADD COLUMN "model_ids" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE "user_ai_keys" SET "model_ids" = ARRAY["model_id"] WHERE "model_id" IS NOT NULL;
