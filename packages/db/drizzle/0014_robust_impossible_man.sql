ALTER TABLE "numbatrak_customer_orders" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_customer_id_numbatrak_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."numbatrak_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_customer_idx" ON "numbatrak_customer_orders" USING btree ("customer_id");--> statement-breakpoint

-- Backfill: historical orders predate the customerId link above, so without
-- this they'd show broken LTV until their next order. One customer row per
-- (organization_id, phone_number), named from that phone's most recent order.
INSERT INTO "numbatrak_customers" ("organization_id", "name", "phone")
SELECT DISTINCT ON (organization_id, phone_number)
  organization_id,
  COALESCE(customer_name, 'Unknown Customer'),
  phone_number
FROM "numbatrak_customer_orders"
WHERE phone_number IS NOT NULL
ORDER BY organization_id, phone_number, created_at DESC
ON CONFLICT ("organization_id", "phone") DO NOTHING;--> statement-breakpoint

UPDATE "numbatrak_customer_orders" o
SET "customer_id" = c.id
FROM "numbatrak_customers" c
WHERE o.phone_number IS NOT NULL
  AND o.customer_id IS NULL
  AND c.organization_id = o.organization_id
  AND c.phone = o.phone_number;