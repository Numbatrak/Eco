-- CSR resolution helper + optional csr_id on form_responses (for dashboard / reports filters)
-- Run after 002_greenfield_ledger.sql

-- ---------------------------------------------------------------------------
-- Link form responses to CSR (nullable; backfill can set from customer_orders later)
-- ---------------------------------------------------------------------------
ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS csr_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_responses_csr
  ON public.form_responses(organization_id, csr_id)
  WHERE csr_id IS NOT NULL;

COMMENT ON COLUMN public.form_responses.csr_id IS 'Customer success rep; mirrors customer_orders.csr_id when synced';

-- ---------------------------------------------------------------------------
-- Resolve free-text CSR names (e.g. from deliveries.csr) to user_profiles.id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_csr_user_id(
  p_organization_id uuid,
  p_raw text
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT a.user_id
  FROM public.csr_name_aliases a
  WHERE a.organization_id = p_organization_id
    AND lower(trim(p_raw)) LIKE '%' || lower(trim(a.match_pattern)) || '%'
  ORDER BY length(a.match_pattern) DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_csr_user_id IS 'Best-effort match; prefer exact aliases in csr_name_aliases.';

-- After creating Nuella and CRS1 in user_profiles, run (replace UUIDs):
-- INSERT INTO public.csr_name_aliases (organization_id, match_pattern, user_id) VALUES
--   ('<org_id>', 'nuella', '<user_uuid>'),
--   ('<org_id>', 'crs1', '<user_uuid>'),
--   ('<org_id>', 'crs', '<user_uuid_crs1_or_shared>')
-- ON CONFLICT (organization_id, match_pattern) DO UPDATE SET user_id = EXCLUDED.user_id;
