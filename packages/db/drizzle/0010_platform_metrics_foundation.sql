ALTER TABLE "organization" ADD COLUMN "signup_utm_source" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_medium" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_campaign" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_content" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_term" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_referrer" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_landing_path" text;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD COLUMN "utm_term" text;--> statement-breakpoint
CREATE TABLE "user_activity_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"activity_date" date NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_activity_days_user_date_unique_idx" ON "user_activity_days" USING btree ("user_id","activity_date");--> statement-breakpoint
CREATE INDEX "user_activity_days_date_idx" ON "user_activity_days" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "user_activity_days_org_idx" ON "user_activity_days" USING btree ("organization_id");--> statement-breakpoint
CREATE TABLE "platform_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"mrr_cents" integer DEFAULT 0 NOT NULL,
	"arr_cents" integer DEFAULT 0 NOT NULL,
	"active_subscriptions" integer DEFAULT 0 NOT NULL,
	"trial_accounts" integer DEFAULT 0 NOT NULL,
	"active_by_tier" jsonb DEFAULT '{}' NOT NULL,
	"subscription_revenue_cents" integer DEFAULT 0 NOT NULL,
	"credit_revenue_cents" integer DEFAULT 0 NOT NULL,
	"new_signups" integer DEFAULT 0 NOT NULL,
	"trial_starts" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"churned_count" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_metric_snapshots_date_unique_idx" ON "platform_metric_snapshots" USING btree ("snapshot_date");
