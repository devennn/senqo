ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "handoff_called" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "handoff_topic_entry_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_handoff_topic_entry_id_workspace_handoff_topic_entries_id_fk" FOREIGN KEY ("handoff_topic_entry_id") REFERENCES "public"."workspace_handoff_topic_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
