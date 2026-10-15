ALTER TABLE "agent_configs" ADD COLUMN IF NOT EXISTS "evals_enabled" boolean NOT NULL DEFAULT true;
