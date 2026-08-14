CREATE TABLE IF NOT EXISTS "eval_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"eval_case_id" uuid NOT NULL,
	"repeat" text NOT NULL,
	"weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"month_day" integer,
	"hour" integer NOT NULL,
	"minute" integer NOT NULL,
	"timezone" text NOT NULL,
	"notify_user_id" uuid,
	"last_fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eval_schedules" ADD CONSTRAINT "eval_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "eval_schedules" ADD CONSTRAINT "eval_schedules_eval_case_id_eval_cases_id_fk" FOREIGN KEY ("eval_case_id") REFERENCES "public"."eval_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "eval_schedules" ADD CONSTRAINT "eval_schedules_notify_user_id_users_id_fk" FOREIGN KEY ("notify_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "eval_schedules_workspace_eval_case_uidx" ON "eval_schedules" USING btree ("workspace_id","eval_case_id");
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "schedule_id" uuid;
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "email_sent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "notify_email" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_schedule_id_eval_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."eval_schedules"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
