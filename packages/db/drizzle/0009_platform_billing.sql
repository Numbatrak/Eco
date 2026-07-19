CREATE TYPE "public"."platform_subscription_status" AS ENUM('trial', 'active', 'past_due', 'locked', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."platform_transaction_type" AS ENUM('subscription', 'credit_purchase');
--> statement-breakpoint
CREATE TYPE "public"."platform_transaction_status" AS ENUM('success', 'failed', 'refunded');
--> statement-breakpoint
CREATE TYPE "public"."platform_credit_type" AS ENUM('email', 'whatsapp');
--> statement-breakpoint
CREATE TABLE "platform_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"price_monthly_cents" integer NOT NULL,
	"price_annually_cents" integer NOT NULL,
	"limits" jsonb DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "platform_plans" ("name", "display_name", "price_monthly_cents", "price_annually_cents", "limits") VALUES
(
  'starter',
  'Starter',
  999900,
  9599000,
  '{"staffRecordCount": 5, "seatCount": 2, "monthlyOrderVolume": 300, "storefrontCount": 1, "monthlyEmailCredits": 500, "monthlyWhatsappCredits": 100}'
),
(
  'growth',
  'Growth',
  2999900,
  28799000,
  '{"staffRecordCount": 25, "seatCount": 5, "monthlyOrderVolume": 2000, "storefrontCount": 3, "monthlyEmailCredits": 5000, "monthlyWhatsappCredits": 1000}'
),
(
  'pro',
  'Pro',
  4999900,
  47990000,
  '{"staffRecordCount": -1, "seatCount": -1, "monthlyOrderVolume": -1, "storefrontCount": 10, "monthlyEmailCredits": 25000, "monthlyWhatsappCredits": 5000}'
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "plan_id" uuid REFERENCES "platform_plans"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE "platform_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "platform_subscription_status" DEFAULT 'trial' NOT NULL,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"grace_period_ends_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"paystack_subscription_code" text,
	"paystack_customer_code" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_id_platform_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."platform_plans"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_subscriptions_org_unique_idx" ON "platform_subscriptions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "platform_subscriptions_status_idx" ON "platform_subscriptions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "platform_subscriptions_grace_period_idx" ON "platform_subscriptions" USING btree ("grace_period_ends_at");
--> statement-breakpoint
CREATE INDEX "platform_subscriptions_locked_at_idx" ON "platform_subscriptions" USING btree ("locked_at");
--> statement-breakpoint
CREATE TABLE "platform_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"type" "platform_transaction_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"paystack_reference" text NOT NULL,
	"status" "platform_transaction_status" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_transactions" ADD CONSTRAINT "platform_transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_transactions_reference_unique_idx" ON "platform_transactions" USING btree ("paystack_reference");
--> statement-breakpoint
CREATE INDEX "platform_transactions_org_idx" ON "platform_transactions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "platform_transactions_status_idx" ON "platform_transactions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "platform_transactions_created_at_idx" ON "platform_transactions" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE "platform_billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_reference" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_billing_webhook_events_reference_unique_idx" ON "platform_billing_webhook_events" USING btree ("event_reference");
--> statement-breakpoint
CREATE TABLE "platform_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"credit_type" "platform_credit_type" NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"admin_id" text,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_credit_ledger" ADD CONSTRAINT "platform_credit_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_credit_ledger" ADD CONSTRAINT "platform_credit_ledger_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_credit_ledger" ADD CONSTRAINT "platform_credit_ledger_transaction_id_platform_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."platform_transactions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "platform_credit_ledger_org_idx" ON "platform_credit_ledger" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "platform_credit_ledger_org_type_idx" ON "platform_credit_ledger" USING btree ("organization_id", "credit_type");
