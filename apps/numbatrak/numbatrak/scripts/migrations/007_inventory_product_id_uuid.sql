-- Align public.inventory.product_id with public.products.id (UUID).
-- Legacy schemas often use BIGINT for product_id; the app now sends/correctly uses UUIDs.
-- Rows that only store a legacy integer cannot be auto-converted to a product UUID, so
-- this migration clears the inventory table when a type change is required, then sets UUID.
-- Backup first if you need old totals: SELECT * FROM public.inventory; (export to CSV)
--
-- Safe to re-run: no-op if product_id is already uuid.

DO $m$
DECLARE
  dt text;
BEGIN
  SELECT c.data_type INTO dt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'inventory'
    AND c.column_name = 'product_id';

  IF dt IS NULL THEN
    RAISE NOTICE '007: public.inventory.product_id not found; skip.';
    RETURN;
  END IF;

  IF dt = 'uuid' THEN
    RAISE NOTICE '007: inventory.product_id is already uuid; skip.';
    RETURN;
  END IF;

  IF dt NOT IN ('bigint', 'integer', 'smallint') THEN
    RAISE NOTICE '007: inventory.product_id is %; manual migration needed.', dt;
    RETURN;
  END IF;

  RAISE NOTICE '007: Converting inventory.product_id from % to uuid (deleting all inventory rows first).', dt;

  -- Drop FK + UNIQUE that involve product_id (Postgres will not alter type otherwise)
  ALTER TABLE public.inventory
    DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
  ALTER TABLE public.inventory
    DROP CONSTRAINT IF EXISTS inventory_organization_id_product_id_agent_id_key;
  ALTER TABLE public.inventory
    DROP CONSTRAINT IF EXISTS uq_inventory_org_agent_product;
  ALTER TABLE public.inventory
    DROP CONSTRAINT IF EXISTS inventory_organization_id_agent_id_product_id_key;
  ALTER TABLE public.inventory
    DROP CONSTRAINT IF EXISTS inventory_agent_id_product_id_organization_id_key;

  DELETE FROM public.inventory;

  ALTER TABLE public.inventory
    ALTER COLUMN product_id DROP NOT NULL;

  ALTER TABLE public.inventory
    ALTER COLUMN product_id TYPE uuid
    USING NULL::uuid;

  ALTER TABLE public.inventory
    ALTER COLUMN product_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products (id) ON DELETE RESTRICT;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '007: FK inventory_product_id_fkey already present.';
  END;

  -- App upsert: onConflict "agent_id,product_id,organization_id"
  BEGIN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_agent_id_product_id_organization_id_key
      UNIQUE (agent_id, product_id, organization_id);
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '007: Unique (agent, product, org) already present.';
  END;

  RAISE NOTICE '007: Done. Re-add inventory in the app (ledger uses stock_movements separately).';
END
$m$;
