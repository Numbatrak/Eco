CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text,
	"title" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_delivery_zone_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"state" text NOT NULL,
	"fee_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_utm_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_utm_medium" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_utm_campaign" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_utm_term" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_utm_content" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_referrer" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_landing_path" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_fbclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_ttclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_gclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_delivery_zone_rates" ADD CONSTRAINT "tenant_delivery_zone_rates_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_tenant_code_idx" ON "discounts" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "discounts_tenant_active_idx" ON "discounts" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_delivery_zone_rates_tenant_state_idx" ON "tenant_delivery_zone_rates" USING btree ("tenant_id","state");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE set null ON UPDATE no action;