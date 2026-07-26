-- RLS for public.deliveries (waybill / delivery rows)
-- Fixes: new row violates row-level security policy for table "deliveries"
-- Same org membership pattern as scripts/migrations/008_inventory_rls.sql

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select" ON public.deliveries;
CREATE POLICY "deliveries_select" ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deliveries_insert" ON public.deliveries;
CREATE POLICY "deliveries_insert" ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deliveries_update" ON public.deliveries;
CREATE POLICY "deliveries_update" ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deliveries_delete" ON public.deliveries;
CREATE POLICY "deliveries_delete" ON public.deliveries
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
