CREATE TYPE "public"."order_source" AS ENUM('store', 'funnel');--> statement-breakpoint
CREATE TABLE "product_funnel_config" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" "order_source" DEFAULT 'store' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_funnel_config" ADD CONSTRAINT "product_funnel_config_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;