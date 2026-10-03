ALTER TABLE "user_ai_keys" DROP CONSTRAINT "user_ai_keys_pkey";--> statement-breakpoint
ALTER TABLE "user_ai_keys" ADD CONSTRAINT "user_ai_keys_user_id_provider_pk" PRIMARY KEY("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "user_ai_keys_one_enabled" ON "user_ai_keys" USING btree ("user_id") WHERE "user_ai_keys"."enabled";
