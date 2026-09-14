-- Repoint numbatrak_follow_ups.order_id at numbatrak_customer_orders(id).
-- Previously a plain uuid with no FK (legacy anomaly - the source Supabase
-- follow_ups.order_id pointed at a never-ported `orders` table). Auto-created
-- follow-ups only ever populated abandoned_cart_id, so any existing order_id
-- values are leftovers from that legacy table and won't match
-- numbatrak_customer_orders ids - null them out before constraining so the
-- FK add doesn't fail on orphans.
UPDATE "numbatrak_follow_ups" SET "order_id" = NULL WHERE "order_id" IS NOT NULL AND "order_id" NOT IN (SELECT "id" FROM "numbatrak_customer_orders");--> statement-breakpoint
ALTER TABLE "numbatrak_follow_ups" ADD CONSTRAINT "numbatrak_follow_ups_order_id_numbatrak_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."numbatrak_customer_orders"("id") ON DELETE set null ON UPDATE no action;
