ALTER TABLE "conversations" DROP CONSTRAINT "uq_conversations_workspace_whatsapp_chat_id";--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "uq_conversations_workspace_connection_whatsapp_chat_id" UNIQUE("workspace_id","whatsapp_connection_id","whatsapp_chat_id");
