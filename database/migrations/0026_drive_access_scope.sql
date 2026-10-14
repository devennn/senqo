ALTER TABLE "workspace_app_connections" ADD COLUMN IF NOT EXISTS "drive_access_mode" text DEFAULT 'entire_drive' NOT NULL;
--> statement-breakpoint
ALTER TABLE "workspace_app_connections" ADD COLUMN IF NOT EXISTS "drive_scope_id" text;
--> statement-breakpoint
ALTER TABLE "workspace_app_connections" ADD COLUMN IF NOT EXISTS "drive_scope_name" text;
--> statement-breakpoint
ALTER TABLE "workspace_app_connections" ADD COLUMN IF NOT EXISTS "drive_scope_mime_type" text;
