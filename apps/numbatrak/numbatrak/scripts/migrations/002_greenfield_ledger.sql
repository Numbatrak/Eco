-- Greenfield ledger: customer orders, line items, stock movements, unified expenses, agent stock views
-- Run after 001. Safe: uses IF NOT EXISTS. Does not drop legacy tables.

-- ---------------------------------------------------------------------------
-- customer_orders: canonical order (v2). Links optionally to form_responses.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_response_id uuid UNIQUE REFERENCES public.form_responses(id) ON DELETE SET NULL,
  form_id uuid REFERENCES public.forms(id) ON DELETE SET NULL,
  csr_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  agent_id bigint REFERENCES public.agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('abandoned','pending','completed','cancelled')),
  source text NOT NULL DEFAULT 'form' CHECK (source IN ('form','manual','converted_from_cart')),
  customer_name text,
  phone_number text,
  state text,
  delivery_address text,
  order_revenue numeric(14,2),
  order_cost numeric(14,2),
  amount_paid numeric(14,2),
  delivery_fee numeric(14,2),
  profit numeric(14,2),
  notes text,
  -- legacy abandoned_carts.id may be BIGSERIAL or UUID depending on deployment; no FK
  abandoned_cart_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_org ON public.customer_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_form_response ON public.customer_orders(form_response_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_csr ON public.customer_orders(csr_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_agent ON public.customer_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_form ON public.customer_orders(form_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON public.customer_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created ON public.customer_orders(organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- customer_order_items: line items (aligns with form_response_items)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_at_submission numeric(14,2) NOT NULL DEFAULT 0,
  unit_cost_at_submission numeric(14,2) NOT NULL DEFAULT 0,
  total_price numeric(14,2) NOT NULL DEFAULT 0,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  profit numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_order_items_order ON public.customer_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_product ON public.customer_order_items(product_id);

-- ---------------------------------------------------------------------------
-- stock_movements: ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN (
    'waybill_to_agent','deliver_to_customer','return_to_lagos','transfer','adjust'
  )),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  from_agent_id bigint REFERENCES public.agents(id) ON DELETE SET NULL,
  to_agent_id bigint REFERENCES public.agents(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  waybill_batch_id uuid,
  legacy_delivery_id bigint,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  cost numeric(14,2) DEFAULT 0,
  fee numeric(14,2) DEFAULT 0,
  recorded_by_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT stock_movements_agents_chk CHECK (
    (movement_type = 'waybill_to_agent' AND to_agent_id IS NOT NULL) OR
    (movement_type = 'deliver_to_customer' AND from_agent_id IS NOT NULL) OR
    (movement_type = 'return_to_lagos' AND from_agent_id IS NOT NULL) OR
    (movement_type = 'transfer' AND from_agent_id IS NOT NULL AND to_agent_id IS NOT NULL) OR
    (movement_type = 'adjust' AND (from_agent_id IS NOT NULL OR to_agent_id IS NOT NULL))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_legacy_delivery
  ON public.stock_movements(legacy_delivery_id) WHERE legacy_delivery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON public.stock_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(organization_id, product_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_from ON public.stock_movements(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_to ON public.stock_movements(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON public.stock_movements(waybill_batch_id) WHERE waybill_batch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- unified_expenses: org + agent scope (replaces parallel reads from old tables)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unified_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('org','agent')),
  category text NOT NULL,
  subcategory text DEFAULT '',
  amount numeric(14,2) NOT NULL,
  agent_id bigint REFERENCES public.agents(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  note text,
  occurred_at date NOT NULL DEFAULT (CURRENT_DATE),
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  legacy_agent_expense_id bigint,
  legacy_general_expense_id bigint,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_unified_expenses_agent_legacy
  ON public.unified_expenses(legacy_agent_expense_id) WHERE legacy_agent_expense_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_unified_expenses_general_legacy
  ON public.unified_expenses(legacy_general_expense_id) WHERE legacy_general_expense_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_expenses_org ON public.unified_expenses(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_expenses_cat ON public.unified_expenses(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_unified_expenses_agent ON public.unified_expenses(agent_id) WHERE scope = 'agent';

-- ---------------------------------------------------------------------------
-- CSR alias mapping (per org) for backfill from free-text "Nuella" / "CRS1"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.csr_name_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  match_pattern text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  UNIQUE(organization_id, match_pattern)
);

-- ---------------------------------------------------------------------------
-- View: on-hand from ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.agent_stock_v AS
SELECT
  t.organization_id,
  t.agent_id,
  t.product_id,
  SUM(t.delta) AS quantity_on_hand
FROM (
  SELECT organization_id, to_agent_id AS agent_id, product_id, quantity::numeric AS delta
  FROM public.stock_movements
  WHERE movement_type = 'waybill_to_agent' AND to_agent_id IS NOT NULL
  UNION ALL
  SELECT organization_id, from_agent_id, product_id, -quantity::numeric
  FROM public.stock_movements
  WHERE movement_type = 'deliver_to_customer' AND from_agent_id IS NOT NULL
  UNION ALL
  SELECT organization_id, from_agent_id, product_id, -quantity::numeric
  FROM public.stock_movements
  WHERE movement_type = 'return_to_lagos' AND from_agent_id IS NOT NULL
  UNION ALL
  SELECT organization_id, to_agent_id, product_id, quantity::numeric
  FROM public.stock_movements
  WHERE movement_type = 'transfer' AND to_agent_id IS NOT NULL
  UNION ALL
  SELECT organization_id, from_agent_id, product_id, -quantity::numeric
  FROM public.stock_movements
  WHERE movement_type = 'transfer' AND from_agent_id IS NOT NULL
  UNION ALL
  SELECT organization_id, COALESCE(from_agent_id, to_agent_id) AS agent_id, product_id, quantity::numeric
  FROM public.stock_movements
  WHERE movement_type = 'adjust' AND (from_agent_id IS NOT NULL OR to_agent_id IS NOT NULL)
) t
GROUP BY t.organization_id, t.agent_id, t.product_id;

CREATE OR REPLACE VIEW public.agent_stock_breakdown_v AS
WITH w AS (
  SELECT organization_id, to_agent_id AS agent_id, product_id, SUM(quantity)::numeric AS waybilled_in
  FROM public.stock_movements
  WHERE movement_type = 'waybill_to_agent' AND to_agent_id IS NOT NULL
  GROUP BY organization_id, to_agent_id, product_id
),
d AS (
  SELECT organization_id, from_agent_id AS agent_id, product_id, SUM(quantity)::numeric AS delivered_out
  FROM public.stock_movements
  WHERE movement_type = 'deliver_to_customer' AND from_agent_id IS NOT NULL
  GROUP BY organization_id, from_agent_id, product_id
),
keys AS (
  SELECT organization_id, agent_id, product_id FROM w
  UNION
  SELECT organization_id, agent_id, product_id FROM d
)
SELECT
  k.organization_id,
  k.agent_id,
  k.product_id,
  COALESCE(w.waybilled_in, 0) AS waybilled_in,
  COALESCE(d.delivered_out, 0) AS delivered_to_customer,
  COALESCE(w.waybilled_in, 0) - COALESCE(d.delivered_out, 0) AS approx_remaining
FROM keys k
LEFT JOIN w ON w.organization_id = k.organization_id AND w.agent_id = k.agent_id AND w.product_id = k.product_id
LEFT JOIN d ON d.organization_id = k.organization_id AND d.agent_id = k.agent_id AND d.product_id = k.product_id;

-- RLS
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csr_name_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_orders_select" ON public.customer_orders;
CREATE POLICY "customer_orders_select" ON public.customer_orders FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "customer_orders_insert" ON public.customer_orders;
CREATE POLICY "customer_orders_insert" ON public.customer_orders FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "customer_orders_update" ON public.customer_orders;
CREATE POLICY "customer_orders_update" ON public.customer_orders FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "customer_orders_delete" ON public.customer_orders;
CREATE POLICY "customer_orders_delete" ON public.customer_orders FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "customer_order_items_all" ON public.customer_order_items;
CREATE POLICY "customer_order_items_all" ON public.customer_order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_orders o
    WHERE o.id = customer_order_items.order_id
    AND o.organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customer_orders o
    WHERE o.id = customer_order_items.order_id
    AND o.organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "stock_movements_all" ON public.stock_movements;
CREATE POLICY "stock_movements_all" ON public.stock_movements FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "unified_expenses_all" ON public.unified_expenses;
CREATE POLICY "unified_expenses_all" ON public.unified_expenses FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "csr_name_aliases_all" ON public.csr_name_aliases;
CREATE POLICY "csr_name_aliases_all" ON public.csr_name_aliases FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Updated_at trigger (reuse if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at_customer_orders()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_customer_orders_updated ON public.customer_orders;
CREATE TRIGGER trg_customer_orders_updated
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at_customer_orders();
