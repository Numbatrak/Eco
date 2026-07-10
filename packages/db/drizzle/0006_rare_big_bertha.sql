CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "credit_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"admin_id" text,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserved_subdomains" (
	"word" text PRIMARY KEY NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admin_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admin_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "platform_admin_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "platform_admin_two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_admin_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "platform_admin_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "platform_admin_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "status" "organization_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "credit_adjustments_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "credit_adjustments_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_log" ADD CONSTRAINT "platform_admin_audit_log_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserved_subdomains" ADD CONSTRAINT "reserved_subdomains_added_by_platform_admin_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_account" ADD CONSTRAINT "platform_admin_account_user_id_platform_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_session" ADD CONSTRAINT "platform_admin_session_user_id_platform_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_two_factor" ADD CONSTRAINT "platform_admin_two_factor_user_id_platform_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_adjustments_tenant_idx" ON "credit_adjustments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "platform_admin_audit_log_admin_idx" ON "platform_admin_audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "platform_admin_audit_log_created_at_idx" ON "platform_admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_admin_account_userId_idx" ON "platform_admin_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_admin_session_userId_idx" ON "platform_admin_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_admin_two_factor_secret_idx" ON "platform_admin_two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "platform_admin_two_factor_userId_idx" ON "platform_admin_two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_admin_verification_identifier_idx" ON "platform_admin_verification" USING btree ("identifier");--> statement-breakpoint
-- Seed reserved_subdomains from the words previously hardcoded as the
-- RESERVED_SUBDOMAINS env var / DEFAULT_RESERVED_SUBDOMAINS fallback in
-- apps/api/src/modules/sites/lib/subdomain.ts - this table is now the
-- source of truth, added_by is NULL for the initial seed (no admin acted).
INSERT INTO "reserved_subdomains" ("word") VALUES
	('www'), ('api'), ('admin'), ('app'), ('mail'), ('status'), ('blog'), ('help'), ('docs'), ('cdn'), ('assets')
ON CONFLICT ("word") DO NOTHING;--> statement-breakpoint
INSERT INTO "platform_settings" ("key", "value") VALUES
	('support_email', 'support@example.com'),
	('maintenance_mode', 'false')
ON CONFLICT ("key") DO NOTHING;