-- Abandoned carts stabilization: attribution fields, convert FK, contact-required inserts

ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS funnel_name text,
  ADD COLUMN IF NOT EXISTS offer_name text,
  ADD COLUMN IF NOT EXISTS sub_brand text;

COMMENT ON COLUMN public.abandoned_carts.funnel_name IS 'Funnel label stamped from form at capture.';
COMMENT ON COLUMN public.abandoned_carts.offer_name IS 'Selected package/offer label at abandon time.';
COMMENT ON COLUMN public.abandoned_carts.sub_brand IS 'Sub-brand stamped from form at capture.';

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_funnel
  ON public.abandoned_carts (organization_id, funnel_name)
  WHERE funnel_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_offer
  ON public.abandoned_carts (organization_id, offer_name)
  WHERE offer_name IS NOT NULL;

-- converted_order_id should reference canonical customer_orders (not legacy orders)
ALTER TABLE public.abandoned_carts
  DROP CONSTRAINT IF EXISTS abandoned_carts_converted_order_id_fkey;

ALTER TABLE public.abandoned_carts
  ADD CONSTRAINT abandoned_carts_converted_order_id_fkey
  FOREIGN KEY (converted_order_id)
  REFERENCES public.customer_orders(id)
  ON DELETE SET NULL;

-- Public embed inserts: require contact (name + phone or WhatsApp) on active forms
DROP POLICY IF EXISTS "Public can insert abandoned carts for active forms" ON public.abandoned_carts;

CREATE POLICY "Public can insert abandoned carts for active forms"
  ON public.abandoned_carts
  FOR INSERT
  TO anon
  WITH CHECK (
    form_id IS NOT NULL
    AND organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.forms f
      WHERE f.id = form_id
        AND f.organization_id = abandoned_carts.organization_id
        AND f.active = true
    )
    AND customer_name IS NOT NULL
    AND TRIM(customer_name) <> ''
    AND (
      (phone_number IS NOT NULL AND TRIM(phone_number) <> '')
      OR (whatsapp_number IS NOT NULL AND TRIM(whatsapp_number) <> '')
    )
  );

-- Backfill attribution from linked forms where missing
UPDATE public.abandoned_carts ac
SET
  funnel_name = COALESCE(NULLIF(TRIM(ac.funnel_name), ''), NULLIF(TRIM(f.funnel_name), ''), f.name),
  sub_brand = COALESCE(ac.sub_brand, f.sub_brand),
  updated_at = NOW()
FROM public.forms f
WHERE ac.form_id = f.id
  AND (ac.funnel_name IS NULL OR ac.sub_brand IS NULL);
