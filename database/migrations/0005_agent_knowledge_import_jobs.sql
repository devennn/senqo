CREATE TABLE "agent_knowledge_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"profile_name" text NOT NULL,
	"status" text NOT NULL,
	"targets" jsonb NOT NULL,
	"focus_hint" text DEFAULT '' NOT NULL,
	"files" jsonb NOT NULL,
	"draft" jsonb,
	"selection" jsonb,
	"workspace_refs" jsonb DEFAULT '{"contextGroups":{},"templateGroups":{}}'::jsonb NOT NULL,
	"error_message" text,
	"queue_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_knowledge_import_jobs" ADD CONSTRAINT "agent_knowledge_import_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_knowledge_import_jobs" ADD CONSTRAINT "agent_knowledge_import_jobs_agent_id_agent_configs_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_configs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_knowledge_import_jobs_agent_status_idx" ON "agent_knowledge_import_jobs" USING btree ("workspace_id","agent_id","status");
