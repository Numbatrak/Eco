-- Section 06: four expense categories (operational, building, marketing, advertising)

-- Backfill org-scoped legacy category slugs
UPDATE public.unified_expenses
SET
  category = CASE lower(category)
    WHEN 'ads' THEN 'advertising'
    WHEN 'marketing_materials' THEN 'marketing'
    WHEN 'technical' THEN 'building'
    WHEN 'salary' THEN 'operational'
    WHEN 'logistics_waybill' THEN 'operational'
    WHEN 'logistics' THEN 'operational'
    WHEN 'other' THEN 'operational'
    ELSE category
  END,
  subcategory = CASE
    WHEN lower(category) = 'ads' AND (subcategory IS NULL OR subcategory = '')
      THEN 'other_paid_placement'
    WHEN lower(category) = 'marketing_materials' AND (subcategory IS NULL OR subcategory = '')
      THEN 'content_creation'
    WHEN lower(category) = 'technical' AND (subcategory IS NULL OR subcategory = '')
      THEN 'software_development'
    WHEN lower(category) = 'salary' AND (subcategory IS NULL OR subcategory = '')
      THEN 'salaries_wages'
    WHEN lower(category) IN ('logistics_waybill', 'logistics') AND (subcategory IS NULL OR subcategory = '')
      THEN 'logistics_delivery_fees'
    ELSE COALESCE(subcategory, '')
  END
WHERE scope = 'org'
  AND lower(category) NOT IN ('operational', 'building', 'marketing', 'advertising');

-- Agent-scoped: category becomes operational; legacy category value moves to subcategory
UPDATE public.unified_expenses
SET
  subcategory = CASE
    WHEN subcategory IS NOT NULL AND subcategory <> '' THEN subcategory
    WHEN lower(category) IN ('pos_charge', 'failed_delivery', 'other') THEN lower(category)
    ELSE COALESCE(NULLIF(subcategory, ''), 'other')
  END,
  category = 'operational'
WHERE scope = 'agent'
  AND lower(category) NOT IN ('operational', 'building', 'marketing', 'advertising');

-- Enforce four org categories + operational agent bucket
ALTER TABLE public.unified_expenses
  DROP CONSTRAINT IF EXISTS unified_expenses_org_category_check;

ALTER TABLE public.unified_expenses
  ADD CONSTRAINT unified_expenses_org_category_check
  CHECK (
    scope <> 'org'
    OR category = ANY (ARRAY['operational', 'building', 'marketing', 'advertising']::text[])
  );

ALTER TABLE public.unified_expenses
  DROP CONSTRAINT IF EXISTS unified_expenses_agent_category_check;

ALTER TABLE public.unified_expenses
  ADD CONSTRAINT unified_expenses_agent_category_check
  CHECK (scope <> 'agent' OR category = 'operational');

COMMENT ON COLUMN public.unified_expenses.category IS
  'Org: operational | building | marketing | advertising. Agent: operational.';
