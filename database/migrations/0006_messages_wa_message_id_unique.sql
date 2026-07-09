ALTER TABLE "messages" ADD COLUMN "wa_message_id" text;--> statement-breakpoint
UPDATE "messages"
SET "wa_message_id" = NULLIF(TRIM(COALESCE(
  "metadata"->>'whatsappMessageId',
  "metadata"->>'webhookMessageId',
  "metadata"->>'greenMessageId'
)), '')
WHERE "wa_message_id" IS NULL;--> statement-breakpoint
DELETE FROM "messages" AS m
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, wa_message_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM "messages"
  WHERE wa_message_id IS NOT NULL
) AS d
WHERE m.id = d.id AND d.rn > 1;--> statement-breakpoint
UPDATE "messages"
SET "metadata" = jsonb_set(
  "metadata",
  '{whatsappMessageId}',
  to_jsonb("wa_message_id"),
  true
)
WHERE "wa_message_id" IS NOT NULL
  AND (
    "metadata"->>'whatsappMessageId' IS NULL
    OR TRIM(COALESCE("metadata"->>'whatsappMessageId', '')) = ''
  );--> statement-breakpoint
CREATE UNIQUE INDEX "idx_messages_workspace_wa_message_id_unique" ON "messages" USING btree ("workspace_id","wa_message_id") WHERE "wa_message_id" is not null;--> statement-breakpoint
UPDATE "agent_messages"
SET "wa_message_id" = NULLIF(TRIM("provider_options"->>'whatsappMessageId'), '')
WHERE "wa_message_id" IS NULL
  AND "provider_options" ? 'whatsappMessageId';--> statement-breakpoint
DELETE FROM "agent_messages" AS m
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, wa_message_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM "agent_messages"
  WHERE wa_message_id IS NOT NULL
) AS d
WHERE m.id = d.id AND d.rn > 1;--> statement-breakpoint
DROP INDEX IF EXISTS "idx_agent_messages_wa_message_id";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_messages_workspace_wa_message_id_unique" ON "agent_messages" USING btree ("workspace_id","wa_message_id") WHERE "wa_message_id" is not null;
