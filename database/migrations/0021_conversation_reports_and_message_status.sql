ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "status" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_failed_workspace_created" ON "messages" USING btree ("workspace_id","created_at" DESC) WHERE "status" = 'failed';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversation_reports_workspace_created" ON "conversation_reports" USING btree ("workspace_id","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversation_reports_conversation" ON "conversation_reports" USING btree ("conversation_id");