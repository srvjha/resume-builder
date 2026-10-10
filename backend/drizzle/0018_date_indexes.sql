CREATE INDEX "link_views_viewed_at_index" ON "link_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "ai_runs_created_at_index" ON "ai_runs" USING btree ("created_at");