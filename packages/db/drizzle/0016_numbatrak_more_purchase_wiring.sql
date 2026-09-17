ALTER TABLE "numbatrak_stock_movements" DROP CONSTRAINT "numbatrak_stock_movements_movement_type_chk";--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" DROP CONSTRAINT "numbatrak_stock_movements_agents_chk";--> statement-breakpoint
ALTER TABLE "numbatrak_more_purchases" ALTER COLUMN "product_id" SET DATA TYPE uuid USING "product_id"::uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_more_purchases" ALTER COLUMN "agent_id" SET DATA TYPE bigint USING "agent_id"::bigint;--> statement-breakpoint
ALTER TABLE "numbatrak_more_purchases" ADD CONSTRAINT "numbatrak_more_purchases_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_more_purchases" ADD CONSTRAINT "numbatrak_more_purchases_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_movement_type_chk" CHECK ("numbatrak_stock_movements"."movement_type" IN ('waybill_to_agent', 'deliver_to_customer', 'return_to_lagos', 'transfer', 'adjust', 'damaged', 'missing', 'replacement', 'more_purchase'));--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_agents_chk" CHECK (("numbatrak_stock_movements"."movement_type" = 'waybill_to_agent' AND "numbatrak_stock_movements"."to_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'deliver_to_customer' AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'return_to_lagos' AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'transfer' AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL AND "numbatrak_stock_movements"."to_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'adjust' AND ("numbatrak_stock_movements"."from_agent_id" IS NOT NULL OR "numbatrak_stock_movements"."to_agent_id" IS NOT NULL))
        OR ("numbatrak_stock_movements"."movement_type" IN ('damaged', 'missing', 'replacement', 'more_purchase') AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL));