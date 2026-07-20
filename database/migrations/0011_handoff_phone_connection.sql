-- Scope handoff phone registration to a WhatsApp connection (OTP + alerts from that line only).
ALTER TABLE "workspace_handoff_phones" ADD COLUMN IF NOT EXISTS "whatsapp_connection_id" uuid;
--> statement-breakpoint
ALTER TABLE "workspace_handoff_phone_verifications" ADD COLUMN IF NOT EXISTS "whatsapp_connection_id" uuid;
--> statement-breakpoint
-- Drop legacy rows that have no connection binding (cannot send under the new model).
DELETE FROM "workspace_handoff_phone_verifications" WHERE "whatsapp_connection_id" IS NULL;
--> statement-breakpoint
DELETE FROM "workspace_handoff_phones" WHERE "whatsapp_connection_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "workspace_handoff_phones" ALTER COLUMN "whatsapp_connection_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "workspace_handoff_phone_verifications" ALTER COLUMN "whatsapp_connection_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "workspace_handoff_phones" DROP CONSTRAINT IF EXISTS "workspace_handoff_phones_whatsapp_connection_id_whatsapp_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_handoff_phones" ADD CONSTRAINT "workspace_handoff_phones_whatsapp_connection_id_whatsapp_connections_id_fk" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "public"."whatsapp_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_handoff_phone_verifications" DROP CONSTRAINT IF EXISTS "workspace_handoff_phone_verifications_whatsapp_connection_id_whatsapp_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_handoff_phone_verifications" ADD CONSTRAINT "workspace_handoff_phone_verifications_whatsapp_connection_id_whatsapp_connections_id_fk" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "public"."whatsapp_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_handoff_phones_workspace_user_uidx";
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_handoff_phone_verifications_workspace_user_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_handoff_phones_workspace_user_connection_uidx" ON "workspace_handoff_phones" USING btree ("workspace_id","user_id","whatsapp_connection_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_handoff_phone_verifications_workspace_user_connection_uidx" ON "workspace_handoff_phone_verifications" USING btree ("workspace_id","user_id","whatsapp_connection_id");
