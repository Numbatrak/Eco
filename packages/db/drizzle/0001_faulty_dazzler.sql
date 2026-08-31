CREATE TYPE "public"."order_payment_method" AS ENUM('cod', 'online');--> statement-breakpoint
CREATE TYPE "public"."payment_collection_method" AS ENUM('cod', 'prepaid', 'both');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_payment_settings" ALTER COLUMN "provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" "order_payment_method" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_payment_settings" ADD COLUMN "collection_method" "payment_collection_method" DEFAULT 'prepaid' NOT NULL;