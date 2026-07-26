-- RLS for legacy public.inventory (agent × product × org totals)
-- If RLS was enabled without policies, or only SELECT, inserts fail with:
--   new row violates row-level security policy for table "inventory"
-- Mirrors org scoping in scripts/migrations/002_greenfield_ledger.sql (stock_movements).

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "inventory_insert" ON public.inventory;
CREATE POLICY "inventory_insert" ON public.inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "inventory_update" ON public.inventory;
CREATE POLICY "inventory_update" ON public.inventory
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

DROP POLICY IF EXISTS "inventory_delete" ON public.inventory;
CREATE POLICY "inventory_delete" ON public.inventory
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
