ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "status" text;
--> statement-breakpoint
UPDATE "eval_runs"
SET "status" = CASE WHEN "passed" = true THEN 'passed' ELSE 'failed' END
WHERE "status" IS NULL;
--> statement-breakpoint
ALTER TABLE "eval_runs" ALTER COLUMN "status" SET DEFAULT 'failed';
--> statement-breakpoint
ALTER TABLE "eval_runs" ALTER COLUMN "status" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "error_message" text;
--> statement-breakpoint
ALTER TABLE "eval_runs" DROP COLUMN IF EXISTS "passed";
