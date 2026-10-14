CREATE TABLE IF NOT EXISTS "workspace_app_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"toolkit" text NOT NULL,
	"composio_user_id" text NOT NULL,
	"composio_connected_account_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_app_connections" ADD CONSTRAINT "workspace_app_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_app_connections_workspace_toolkit_uidx" ON "workspace_app_connections" USING btree ("workspace_id","toolkit");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_linked_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"description" text NOT NULL,
	"drive_file_id" text,
	"storage_path" text,
	"file_size_bytes" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_linked_docs" ADD CONSTRAINT "workspace_linked_docs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_linked_docs" ADD CONSTRAINT "workspace_linked_docs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workspace_linked_docs_workspace_updated" ON "workspace_linked_docs" USING btree ("workspace_id","updated_at" DESC);
--> statement-breakpoint
ALTER TABLE "agent_configs" ADD COLUMN IF NOT EXISTS "linked_docs" jsonb DEFAULT '[]'::jsonb;
