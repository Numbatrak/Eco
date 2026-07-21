-- Waybill stabilization (spec §5): sub-brand filter + batch linkage on deliveries

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS sub_brand text,
  ADD COLUMN IF NOT EXISTS waybill_batch_id uuid;

COMMENT ON COLUMN public.deliveries.sub_brand IS
  'Optional sub-brand tag for filters and roll-ups';

COMMENT ON COLUMN public.deliveries.waybill_batch_id IS
  'Links delivery rows posted in one bulk waybill batch';

CREATE INDEX IF NOT EXISTS idx_deliveries_sub_brand
  ON public.deliveries (organization_id, sub_brand)
  WHERE sub_brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_waybill_batch
  ON public.deliveries (organization_id, waybill_batch_id)
  WHERE waybill_batch_id IS NOT NULL;
