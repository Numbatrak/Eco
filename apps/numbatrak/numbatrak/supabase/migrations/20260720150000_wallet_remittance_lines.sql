-- Wallet remittance: agent-per-day lines (spec §4)
-- Expected = delivered value − delivery fees (agent keeps) − net-offs

CREATE TABLE IF NOT EXISTS public.wallet_remittance_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id integer NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  remittance_date date NOT NULL,
  total_delivered_value numeric(14, 2) NOT NULL DEFAULT 0,
  total_delivery_fees numeric(14, 2) NOT NULL DEFAULT 0,
  net_off_amount numeric(14, 2) NOT NULL DEFAULT 0,
  expected_remittance numeric(14, 2) NOT NULL DEFAULT 0,
  actual_amount numeric(14, 2),
  status text NOT NULL DEFAULT 'standing'
    CHECK (status IN ('standing', 'remitted', 'short', 'net_owed')),
  net_off_expense_id uuid REFERENCES public.unified_expenses(id) ON DELETE SET NULL,
  notes text,
  remitted_at timestamptz,
  remitted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, agent_id, remittance_date)
);

CREATE INDEX IF NOT EXISTS idx_wallet_remittance_lines_org_date
  ON public.wallet_remittance_lines (organization_id, remittance_date DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_remittance_lines_org_agent
  ON public.wallet_remittance_lines (organization_id, agent_id);

COMMENT ON TABLE public.wallet_remittance_lines IS
  'One remittance line per agent per calendar day for agent-collected deliveries';

ALTER TABLE public.wallet_remittance_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_remittance_lines_select ON public.wallet_remittance_lines
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY wallet_remittance_lines_insert ON public.wallet_remittance_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Admin', 'Manager')
    )
  );

CREATE POLICY wallet_remittance_lines_update ON public.wallet_remittance_lines
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Admin', 'Manager')
    )
  );

CREATE POLICY wallet_remittance_lines_delete ON public.wallet_remittance_lines
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Admin', 'Manager')
    )
  );

CREATE OR REPLACE TRIGGER update_wallet_remittance_lines_updated_at
  BEFORE UPDATE ON public.wallet_remittance_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
