ALTER TABLE "agent_assets" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_assets" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_assets" ADD COLUMN IF NOT EXISTS "drive_file_id" text;--> statement-breakpoint
ALTER TABLE "agent_assets" ALTER COLUMN "storage_path" DROP NOT NULL;--> statement-breakpoint
INSERT INTO "workspace_asset_groups" ("id", "workspace_id", "name")
SELECT gen_random_uuid(), docs."workspace_id", 'Docs'
FROM (SELECT DISTINCT "workspace_id" FROM "workspace_linked_docs") AS docs
WHERE NOT EXISTS (
	SELECT 1 FROM "workspace_asset_groups" g
	WHERE g."workspace_id" = docs."workspace_id" AND g."name" = 'Docs'
);--> statement-breakpoint
INSERT INTO "agent_assets" ("workspace_id", "group_id", "kind", "source", "file_name", "storage_path", "drive_file_id", "mime_type", "description", "file_size_bytes", "sort_order", "created_at", "updated_at")
SELECT d."workspace_id", dg."group_id", 'doc', d."source", d."file_name", d."storage_path", d."drive_file_id", d."mime_type", d."description", d."file_size_bytes", 0, d."created_at", d."updated_at"
FROM "workspace_linked_docs" d
JOIN (
	SELECT DISTINCT ON (g."workspace_id") g."workspace_id", g."id" AS "group_id"
	FROM "workspace_asset_groups" g
	WHERE g."name" = 'Docs'
	ORDER BY g."workspace_id", g."updated_at", g."id"
) AS dg ON dg."workspace_id" = d."workspace_id";--> statement-breakpoint
UPDATE "agent_configs" ac
SET "asset_groups" = CASE
	WHEN ac."asset_groups" IS NULL THEN jsonb_build_array(dg."group_id")
	WHEN ac."asset_groups" @> to_jsonb(dg."group_id") THEN ac."asset_groups"
	ELSE ac."asset_groups" || to_jsonb(dg."group_id")
END
FROM (
	SELECT DISTINCT ON (g."workspace_id") g."workspace_id", g."id" AS "group_id"
	FROM "workspace_asset_groups" g
	WHERE g."name" = 'Docs'
	ORDER BY g."workspace_id", g."updated_at", g."id"
) AS dg
WHERE dg."workspace_id" = ac."workspace_id"
	AND jsonb_array_length(COALESCE(ac."linked_docs", '[]'::jsonb)) > 0;--> statement-breakpoint
DROP TABLE IF EXISTS "workspace_linked_docs";--> statement-breakpoint
ALTER TABLE "agent_configs" DROP COLUMN IF EXISTS "linked_docs";
