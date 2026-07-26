-- Inventory stabilization: warehouse agent, damaged/missing movement types, low-stock threshold

-- ---------------------------------------------------------------------------
-- Agents: warehouse flag + delivery capability
-- ---------------------------------------------------------------------------
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_warehouse boolean NOT NULL DEFAULT false;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS can_deliver boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.agents.is_warehouse IS
  'Org warehouse / HQ holder — holds stock, does not deliver to customers';
COMMENT ON COLUMN public.agents.can_deliver IS
  'When false, agent cannot be assigned deliveries (warehouse uses false)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_one_warehouse_per_org
  ON public.agents (organization_id)
  WHERE is_warehouse = true;

-- Seed warehouse row per org (idempotent)
INSERT INTO public.agents (organization_id, name, locations, active, is_warehouse, can_deliver)
SELECT o.id, 'Warehouse (HQ)', 'HQ', true, true, false
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.agents a
  WHERE a.organization_id = o.id AND a.is_warehouse = true
);

-- ---------------------------------------------------------------------------
-- Products: optional low-stock alert threshold (per product, org-scoped row)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer;

COMMENT ON COLUMN public.products.low_stock_threshold IS
  'Alert when agent on-hand falls at or below this qty (null = no alert)';

-- ---------------------------------------------------------------------------
-- Movement types: damaged + missing (shrinkage — subtract from agent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (
    movement_type = ANY (
      ARRAY[
        'waybill_to_agent'::text,
        'deliver_to_customer'::text,
        'return_to_lagos'::text,
        'transfer'::text,
        'adjust'::text,
        'damaged'::text,
        'missing'::text
      ]
    )
  );

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_agents_chk;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_agents_chk
  CHECK (
    (
      movement_type = 'waybill_to_agent'
      AND to_agent_id IS NOT NULL
    )
    OR (
      movement_type = 'deliver_to_customer'
      AND from_agent_id IS NOT NULL
    )
    OR (
      movement_type = 'return_to_lagos'
      AND from_agent_id IS NOT NULL
    )
    OR (
      movement_type = 'transfer'
      AND from_agent_id IS NOT NULL
      AND to_agent_id IS NOT NULL
    )
    OR (
      movement_type = 'adjust'
      AND (from_agent_id IS NOT NULL OR to_agent_id IS NOT NULL)
    )
    OR (
      movement_type IN ('damaged', 'missing')
      AND from_agent_id IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- agent_stock_v: full on-hand including transfers, adjusts, damaged, missing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.agent_stock_v AS
SELECT
  organization_id,
  agent_id,
  product_id,
  sum(delta) AS quantity_on_hand
FROM (
  SELECT organization_id, to_agent_id AS agent_id, product_id, quantity::numeric AS delta
  FROM public.stock_movements
  WHERE movement_type = 'waybill_to_agent' AND to_agent_id IS NOT NULL

  UNION ALL
  SELECT organization_id, from_agent_id, product_id, (-quantity)::numeric
  FROM public.stock_movements
  WHERE movement_type = 'deliver_to_customer' AND from_agent_id IS NOT NULL

  UNION ALL
  SELECT organization_id, from_agent_id, product_id, (-quantity)::numeric
  FROM public.stock_movements
  WHERE movement_type = 'return_to_lagos' AND from_agent_id IS NOT NULL

  UNION ALL
  SELECT organization_id, to_agent_id, product_id, quantity::numeric
  FROM public.stock_movements
  WHERE movement_type = 'transfer' AND to_agent_id IS NOT NULL

  UNION ALL
  SELECT organization_id, from_agent_id, product_id, (-quantity)::numeric
  FROM public.stock_movements
  WHERE movement_type = 'transfer' AND from_agent_id IS NOT NULL

  UNION ALL
  SELECT
    organization_id,
    COALESCE(from_agent_id, to_agent_id) AS agent_id,
    product_id,
    CASE
      WHEN from_agent_id IS NOT NULL AND to_agent_id IS NULL THEN (-quantity)::numeric
      ELSE quantity::numeric
    END AS delta
  FROM public.stock_movements
  WHERE movement_type = 'adjust'
    AND (from_agent_id IS NOT NULL OR to_agent_id IS NOT NULL)

  UNION ALL
  SELECT organization_id, from_agent_id, product_id, (-quantity)::numeric
  FROM public.stock_movements
  WHERE movement_type IN ('damaged', 'missing') AND from_agent_id IS NOT NULL
) t
GROUP BY organization_id, agent_id, product_id;

-- ---------------------------------------------------------------------------
-- Non-negative guard (application calls before insert; belt-and-suspenders)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_product_on_hand(
  p_org_id uuid,
  p_agent_id bigint,
  p_product_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT quantity_on_hand
      FROM public.agent_stock_v
      WHERE organization_id = p_org_id
        AND agent_id = p_agent_id
        AND product_id = p_product_id
    ),
    0
  );
$$;

COMMENT ON FUNCTION public.agent_product_on_hand IS
  'Current ledger on-hand for agent × product (used to block negative stock).';
