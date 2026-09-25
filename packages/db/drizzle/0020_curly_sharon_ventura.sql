CREATE TYPE "public"."store_type" AS ENUM('catalog', 'funnel');--> statement-breakpoint
ALTER TABLE "tenant_site_config" ADD COLUMN "store_type" "store_type" DEFAULT 'catalog' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_site_config" ADD COLUMN "funnel_product_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_site_config" ADD CONSTRAINT "tenant_site_config_funnel_product_id_products_id_fk" FOREIGN KEY ("funnel_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;