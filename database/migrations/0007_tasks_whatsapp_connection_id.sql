ALTER TABLE "tasks" ADD COLUMN "whatsapp_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_whatsapp_connection_id_whatsapp_connections_id_fk" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "public"."whatsapp_connections"("id") ON DELETE restrict ON UPDATE no action;
