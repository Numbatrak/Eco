-- Order assignment (CSR round-robin / percentage) — tables expected by
-- src/services/orderAssignmentSettings.ts. Fixes:
--   "Could not find the table 'public.order_assignment_settings' in the schema cache"

CREATE TABLE IF NOT EXISTS public.order_assignment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  assignment_method text NOT NULL DEFAULT 'round_robin' CHECK (assignment_method IN ('round_robin', 'percentage')),
  last_assigned_user_id uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS public.order_assignment_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  percentage numeric(5, 2) NOT NULL DEFAULT 0,
  is_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_order_assignment_settings_org
  ON public.order_assignment_settings (organization_id);
CREATE INDEX IF NOT EXISTS idx_order_assignment_weights_org
  ON public.order_assignment_weights (organization_id);

ALTER TABLE public.order_assignment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_assignment_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_assignment_settings_select" ON public.order_assignment_settings;
CREATE POLICY "order_assignment_settings_select" ON public.order_assignment_settings
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_assignment_settings_insert" ON public.order_assignment_settings;
CREATE POLICY "order_assignment_settings_insert" ON public.order_assignment_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_assignment_settings_update" ON public.order_assignment_settings;
CREATE POLICY "order_assignment_settings_update" ON public.order_assignment_settings
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_assignment_settings_delete" ON public.order_assignment_settings;
CREATE POLICY "order_assignment_settings_delete" ON public.order_assignment_settings
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_assignment_weights_select" ON public.order_assignment_weights;
CREATE POLICY "order_assignment_weights_select" ON public.order_assignment_weights
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_assignment_weights_insert" ON public.order_assignment_weights;
CREATE POLICY "order_assignment_weights_insert" ON public.order_assignment_weights
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_assignment_weights_update" ON public.order_assignment_weights;
CREATE POLICY "order_assignment_weights_update" ON public.order_assignment_weights
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_assignment_weights_delete" ON public.order_assignment_weights;
CREATE POLICY "order_assignment_weights_delete" ON public.order_assignment_weights
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_assignment_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_assignment_weights TO authenticated;
