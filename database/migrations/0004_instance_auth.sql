CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"allow_public_registration" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "instance_settings" ("id", "allow_public_registration") VALUES ('default', true);
--> statement-breakpoint
CREATE TABLE "registration_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"invite_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_invites_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
ALTER TABLE "registration_invites" ADD CONSTRAINT "registration_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "registration_invites_email_idx" ON "registration_invites" USING btree ("email");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_instance_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;
--> statement-breakpoint
DELETE FROM "workspace_members" wm
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = wm.user_id);
