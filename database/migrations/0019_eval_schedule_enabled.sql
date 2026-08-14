ALTER TABLE "eval_schedules" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT true NOT NULL;
