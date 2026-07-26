-- Abandoned carts: let CSRs update carts (convert, edit) and validate public embed inserts.

DROP POLICY IF EXISTS "Customer Relations can update abandoned carts" ON public.abandoned_carts;
CREATE POLICY "Customer Relations can update abandoned carts"
  ON public.abandoned_carts
  FOR UPDATE
  TO authenticated
  USING (public.has_org_role(organization_id, 'Customer Relations'))
  WITH CHECK (public.has_org_role(organization_id, 'Customer Relations'));

DROP POLICY IF EXISTS "Public can insert abandoned carts" ON public.abandoned_carts;
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
  );

-- Backfill historical form_response abandonments into abandoned_carts for the ops UI.
INSERT INTO public.abandoned_carts (
  organization_id,
  form_id,
  customer_name,
  phone_number,
  whatsapp_number,
  delivery_address,
  state,
  location,
  selected_package,
  page_url,
  field_values,
  selected_products,
  filled_fields_count,
  note,
  abandoned_at,
  order_date,
  order_month,
  order_year,
  order_status,
  subject
)
SELECT
  fr.organization_id,
  fr.form_id,
  COALESCE(fr.field_values->>'customer_name', fr.field_values->>'name'),
  COALESCE(
    fr.normalized_payload->>'phone',
    fr.field_values->>'customer_phone',
    fr.field_values->>'phone_number'
  ),
  COALESCE(
    fr.normalized_payload->>'whatsapp',
    fr.field_values->>'whatsapp_number'
  ),
  COALESCE(
    fr.normalized_payload->>'address',
    fr.field_values->>'delivery_address'
  ),
  COALESCE(fr.normalized_payload->>'state', fr.field_values->>'state'),
  COALESCE(fr.field_values->>'location', fr.normalized_payload->>'state'),
  COALESCE(fr.package, fr.field_values->>'selected_package'),
  fr.page_url,
  fr.field_values,
  COALESCE(fr.selected_products, '[]'::jsonb),
  0,
  'Backfilled from form_response ' || fr.id::text,
  COALESCE(fr.submitted_at, fr.created_at, now()),
  COALESCE(fr.submitted_at, fr.created_at, now())::date,
  TO_CHAR(COALESCE(fr.submitted_at, fr.created_at, now()), 'FMMonth'),
  TO_CHAR(COALESCE(fr.submitted_at, fr.created_at, now()), 'YYYY'),
  'Pending',
  'Abandoned Cart'
FROM public.form_responses fr
WHERE fr.response_type = 'abandoned_cart'
  AND NOT EXISTS (
    SELECT 1
    FROM public.abandoned_carts ac
    WHERE ac.note = 'Backfilled from form_response ' || fr.id::text
       OR ac.note = 'Synced from form_response ' || fr.id::text
  );
