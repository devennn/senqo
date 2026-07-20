ALTER TABLE "agent_configs" ADD COLUMN IF NOT EXISTS "handoff_notify_user_ids" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
UPDATE "agent_configs"
SET "handoff_notify_user_ids" = jsonb_build_array("handoff_notify_user_id")
WHERE "handoff_notify_user_id" IS NOT NULL
  AND (
    "handoff_notify_user_ids" IS NULL
    OR "handoff_notify_user_ids" = '[]'::jsonb
  );
--> statement-breakpoint
ALTER TABLE "agent_configs" DROP COLUMN IF EXISTS "handoff_notify_user_id";
