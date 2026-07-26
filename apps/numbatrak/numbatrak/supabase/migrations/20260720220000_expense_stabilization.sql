-- Expenses stabilization: source linkage, attribution, custom subcategories

-- ---------------------------------------------------------------------------
-- Provenance + attribution on unified_expenses
-- ---------------------------------------------------------------------------
ALTER TABLE public.unified_expenses
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS offer_name text,
  ADD COLUMN IF NOT EXISTS platform text;

COMMENT ON COLUMN public.unified_expenses.source_type IS
  'manual | waybill_fee | failed_delivery | wallet_net_off';
COMMENT ON COLUMN public.unified_expenses.source_id IS
  'Stable id for auto-fed rows (delivery id, order id, remittance line id)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_expenses_source_dedup
  ON public.unified_expenses (organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND source_type <> 'manual';

-- ---------------------------------------------------------------------------
-- Org-defined subcategories under each parent category
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_category text NOT NULL,
  slug text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_subcategories_parent_check CHECK (
    parent_category = ANY (
      ARRAY['operational', 'building', 'marketing', 'advertising']::text[]
    )
  ),
  CONSTRAINT expense_subcategories_slug_nonempty CHECK (
    length(trim(slug)) > 0 AND length(trim(label)) > 0
  ),
  UNIQUE (organization_id, parent_category, slug)
);

CREATE INDEX IF NOT EXISTS idx_expense_subcategories_org
  ON public.expense_subcategories (organization_id, parent_category);

ALTER TABLE public.expense_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expense_subcategories in their org"
  ON public.expense_subcategories FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage expense_subcategories"
  ON public.expense_subcategories TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['Owner'::text, 'Admin'::text, 'Manager'::text])
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['Owner'::text, 'Admin'::text, 'Manager'::text])
    )
  );

-- Backfill source_type on existing rows from notes/subcategory heuristics
UPDATE public.unified_expenses
SET source_type = 'waybill_fee'
WHERE source_type = 'manual'
  AND note ILIKE 'Waybill fee%';

UPDATE public.unified_expenses
SET source_type = 'failed_delivery'
WHERE source_type = 'manual'
  AND subcategory = 'failed_delivery'
  AND order_id IS NOT NULL;

UPDATE public.unified_expenses
SET source_type = 'wallet_net_off'
WHERE source_type = 'manual'
  AND subcategory = 'agent_remittance_net_off';
