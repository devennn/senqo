ALTER TABLE "eval_cases" ADD COLUMN IF NOT EXISTS "expected_action" text DEFAULT 'reply' NOT NULL;
--> statement-breakpoint
ALTER TABLE "eval_cases" ADD COLUMN IF NOT EXISTS "expected_topic_entry_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_expected_topic_entry_id_workspace_handoff_topic_entries_id_fk" FOREIGN KEY ("expected_topic_entry_id") REFERENCES "public"."workspace_handoff_topic_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
