CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"order_count" integer DEFAULT 0 NOT NULL,
	"total_spent_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"size" text NOT NULL,
	"color" text NOT NULL,
	"stock_count" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_analytics_settings" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"meta_pixel_id" text,
	"meta_capi_token_encrypted" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_delivery_settings" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"vat_enabled" boolean DEFAULT false NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"delivery_fee_cents" integer DEFAULT 0 NOT NULL,
	"free_delivery_threshold_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'shipped', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
DROP INDEX "cart_items_cart_product_unique_idx";--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_state" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_rate_bps" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_term" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "referrer" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "landing_path" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fbclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ttclid" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gclid" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "compare_at_price_cents" integer;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_analytics_settings" ADD CONSTRAINT "tenant_analytics_settings_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_delivery_settings" ADD CONSTRAINT "tenant_delivery_settings_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_tenant_slug_unique_idx" ON "collections" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "collections_tenant_idx" ON "collections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_email_unique_idx" ON "customers" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_product_size_color_unique_idx" ON "product_variants" USING btree ("product_id","size","color");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_product_variant_unique_idx" ON "cart_items" USING btree ("cart_id","product_id","variant_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "products_collection_idx" ON "products" USING btree ("collection_id");