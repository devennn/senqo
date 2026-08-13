CREATE TABLE IF NOT EXISTS "eval_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "agent_config_id" uuid NOT NULL,
  "title" text NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "expected_reply" text DEFAULT '' NOT NULL,
  "answer_analysis" text,
  "answer_correct" boolean,
  "source_conversation_id" uuid,
  "turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eval_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "eval_case_id" uuid NOT NULL,
  "workspace_id" uuid NOT NULL,
  "passed" boolean NOT NULL,
  "actual_reply" text DEFAULT '' NOT NULL,
  "answer_analysis" text,
  "subject_session_id" uuid,
  "ran_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_agent_config_id_agent_configs_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."agent_configs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_eval_case_id_eval_cases_id_fk" FOREIGN KEY ("eval_case_id") REFERENCES "public"."eval_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_cases_workspace_agent_created" ON "eval_cases" USING btree ("workspace_id","agent_config_id","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_runs_case_ran" ON "eval_runs" USING btree ("eval_case_id","ran_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_runs_workspace_ran" ON "eval_runs" USING btree ("workspace_id","ran_at" DESC);
