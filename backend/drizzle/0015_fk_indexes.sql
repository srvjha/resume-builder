CREATE INDEX "username_redirects_user_id_index" ON "username_redirects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_versions_parent_id_index" ON "resume_versions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "resumes_job_id_index" ON "resumes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "resumes_source_resume_id_index" ON "resumes" USING btree ("source_resume_id");--> statement-breakpoint
CREATE INDEX "resumes_head_version_id_index" ON "resumes" USING btree ("head_version_id");--> statement-breakpoint
CREATE INDEX "share_links_pinned_version_id_index" ON "share_links" USING btree ("pinned_version_id");--> statement-breakpoint
CREATE INDEX "ai_runs_version_id_index" ON "ai_runs" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "ai_runs_job_id_index" ON "ai_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "payments_subscription_id_index" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "promo_redemptions_subscription_id_index" ON "promo_redemptions" USING btree ("subscription_id");