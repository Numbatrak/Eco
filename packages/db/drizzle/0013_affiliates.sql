CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'paused');
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"code" text NOT NULL,
	"commission_rate_bps" integer DEFAULT 1000 NOT NULL,
	"status" "affiliate_status" DEFAULT 'active' NOT NULL,
	"created_by_admin_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_created_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_code_unique_idx" ON "affiliates" USING btree ("code");
--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"recorded_by_admin_id" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_recorded_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "affiliate_payouts_affiliate_idx" ON "affiliate_payouts" USING btree ("affiliate_id");
