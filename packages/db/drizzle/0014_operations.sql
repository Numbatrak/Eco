CREATE TYPE "public"."announcement_audience" AS ENUM('all', 'tier', 'tenant');
--> statement-breakpoint
CREATE TYPE "public"."exit_survey_type" AS ENUM('cancel', 'delete');
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" "announcement_audience" NOT NULL,
	"audience_value" text,
	"send_email" boolean DEFAULT false NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_by_admin_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "exit_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"exit_type" "exit_survey_type" NOT NULL,
	"reason_category" text NOT NULL,
	"detail" text,
	"plan_tier_at_exit" text,
	"tenure_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exit_surveys" ADD CONSTRAINT "exit_surveys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "exit_surveys_created_at_idx" ON "exit_surveys" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE "platform_error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platform_error_log_created_at_idx" ON "platform_error_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "platform_error_log_source_idx" ON "platform_error_log" USING btree ("source");
