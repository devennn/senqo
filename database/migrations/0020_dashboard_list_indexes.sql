DROP INDEX IF EXISTS "idx_conversations_workspace_unarchived_updated";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_workspace_contact" ON "conversations" USING btree ("workspace_id","contact_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_workspace_created" ON "messages" USING btree ("workspace_id","created_at" DESC);
