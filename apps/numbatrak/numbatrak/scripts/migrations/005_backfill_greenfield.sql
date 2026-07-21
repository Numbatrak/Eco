-- Backfill customer_orders + items from form_responses (one-time, idempotent)
-- Run only after 002_greenfield_ledger.sql
--
-- form_responses.agent_id is UUID in some deployments (see setup-form-responses-and-fifo.sql)
-- but customer_orders.agent_id is bigint (FK to agents). UUID cannot cast to bigint.
-- PostgreSQL type-checks *all* arms of a CASE, so a single CASE cannot mix uuid and ::bigint
-- on the same column. We branch with dynamic SQL: numeric agent_id is copied, else NULL.
--
-- When agent_id is uuid, customer_orders.agent_id stays NULL unless you add a mapping table
-- and run a follow-up UPDATE.

DO $bf$
DECLARE
  agent_dtype text;
  ins text;
BEGIN
  SELECT c.data_type INTO agent_dtype
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'form_responses'
    AND c.column_name = 'agent_id';

  IF agent_dtype IS NULL THEN
    RAISE EXCEPTION '005_backfill: public.form_responses.agent_id not found';
  END IF;

  IF agent_dtype IN ('bigint', 'integer', 'smallint') THEN
    ins := $i$
    INSERT INTO public.customer_orders (
      id, organization_id, form_response_id, form_id, csr_id, agent_id, status, source,
      customer_name, phone_number, state, delivery_address,
      order_revenue, order_cost, amount_paid, delivery_fee, profit, notes,
      created_at, completed_at
    )
    SELECT
      gen_random_uuid(),
      fr.organization_id,
      fr.id,
      fr.form_id,
      NULL::uuid,
      fr.agent_id::bigint,
      fr.status,
      'form',
      fr.customer_name,
      fr.phone_number,
      NULL,
      NULL,
      fr.order_revenue,
      fr.order_cost,
      fr.amount_paid,
      fr.delivery_fee,
      fr.profit,
      fr.notes,
      fr.created_at,
      fr.completed_at
    FROM public.form_responses fr
    WHERE fr.response_type = 'order'
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_orders co WHERE co.form_response_id = fr.id
      );
    $i$;
  ELSE
    ins := $i$
    INSERT INTO public.customer_orders (
      id, organization_id, form_response_id, form_id, csr_id, agent_id, status, source,
      customer_name, phone_number, state, delivery_address,
      order_revenue, order_cost, amount_paid, delivery_fee, profit, notes,
      created_at, completed_at
    )
    SELECT
      gen_random_uuid(),
      fr.organization_id,
      fr.id,
      fr.form_id,
      NULL::uuid,
      NULL::bigint,
      fr.status,
      'form',
      fr.customer_name,
      fr.phone_number,
      NULL,
      NULL,
      fr.order_revenue,
      fr.order_cost,
      fr.amount_paid,
      fr.delivery_fee,
      fr.profit,
      fr.notes,
      fr.created_at,
      fr.completed_at
    FROM public.form_responses fr
    WHERE fr.response_type = 'order'
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_orders co WHERE co.form_response_id = fr.id
      );
    $i$;
  END IF;

  EXECUTE ins;
END
$bf$;

INSERT INTO public.customer_order_items (
  id, order_id, product_id, quantity,
  unit_price_at_submission, unit_cost_at_submission, total_price, total_cost, profit, created_at
)
SELECT
  gen_random_uuid(),
  co.id,
  fri.product_id,
  fri.quantity::integer,
  fri.unit_price_at_submission,
  fri.unit_cost_at_submission,
  fri.total_price,
  fri.total_cost,
  fri.profit,
  fri.created_at
FROM public.form_response_items fri
JOIN public.customer_orders co ON co.form_response_id = fri.form_response_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_order_items coi
  WHERE coi.order_id = co.id AND coi.product_id = fri.product_id
);

-- Stock movements from deliveries (only when product_id can join to products.id)
-- Legacy DBs often have deliveries.product_id as bigint; products.id is usually UUID.
-- PostgreSQL has no operator for uuid = bigint, so the join is emitted only when types match.
-- If types differ, skip this step and fix deliveries (or add a product id mapping) then re-run
-- this block or insert movements from the app.

DO $sm$
DECLARE
  d_pt text;
  p_id text;
  ins text;
BEGIN
  SELECT c.data_type INTO d_pt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'deliveries' AND c.column_name = 'product_id';

  SELECT c.data_type INTO p_id
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'products' AND c.column_name = 'id';

  IF d_pt IS NULL OR p_id IS NULL THEN
    RAISE NOTICE '005_backfill: deliveries or products table column missing; skipping stock_movements from deliveries.';
    RETURN;
  END IF;

  IF d_pt = 'uuid' AND p_id = 'uuid' THEN
    ins := $q$
    INSERT INTO public.stock_movements (
      organization_id, movement_type, product_id, quantity,
      from_agent_id, to_agent_id, occurred_at, cost, fee, legacy_delivery_id, notes
    )
    SELECT
      d.organization_id,
      CASE WHEN d.status = 'Waybilled' THEN 'waybill_to_agent' ELSE 'deliver_to_customer' END,
      p.id,
      d.quantity::integer,
      CASE WHEN d.status = 'Delivered' THEN d.agent_id ELSE NULL END,
      CASE WHEN d.status = 'Waybilled' THEN d.agent_id ELSE NULL END,
      COALESCE(d.date::timestamptz, d.created_at, now()),
      COALESCE(d.cost, 0),
      COALESCE(d.waybilling_fee, 0),
      d.id,
      'backfill from deliveries'
    FROM public.deliveries d
    INNER JOIN public.products p ON p.id = d.product_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_movements sm WHERE sm.legacy_delivery_id = d.id
    );
    $q$;
  ELSIF d_pt IN ('bigint', 'integer', 'smallint') AND p_id IN ('bigint', 'integer', 'smallint') THEN
    ins := $q$
    INSERT INTO public.stock_movements (
      organization_id, movement_type, product_id, quantity,
      from_agent_id, to_agent_id, occurred_at, cost, fee, legacy_delivery_id, notes
    )
    SELECT
      d.organization_id,
      CASE WHEN d.status = 'Waybilled' THEN 'waybill_to_agent' ELSE 'deliver_to_customer' END,
      p.id,
      d.quantity::integer,
      CASE WHEN d.status = 'Delivered' THEN d.agent_id ELSE NULL END,
      CASE WHEN d.status = 'Waybilled' THEN d.agent_id ELSE NULL END,
      COALESCE(d.date::timestamptz, d.created_at, now()),
      COALESCE(d.cost, 0),
      COALESCE(d.waybilling_fee, 0),
      d.id,
      'backfill from deliveries'
    FROM public.deliveries d
    INNER JOIN public.products p ON p.id = d.product_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_movements sm WHERE sm.legacy_delivery_id = d.id
    );
    $q$;
  ELSE
    RAISE NOTICE
      '005_backfill: skipping stock_movements from deliveries (product join): deliveries.product_id is %, products.id is %. Align types or add a mapping, then backfill manually.',
      d_pt,
      p_id;
    RETURN;
  END IF;

  EXECUTE ins;
END
$sm$;

-- Unified expenses from legacy tables (only if those tables still exist in your project)
DO $ue$
BEGIN
  IF to_regclass('public.agent_expenses') IS NOT NULL THEN
    INSERT INTO public.unified_expenses (
      organization_id, scope, category, subcategory, amount, agent_id, product_id, occurred_at,
      legacy_agent_expense_id, note, created_at
    )
    SELECT
      e.organization_id,
      'agent',
      COALESCE(e.category, 'other'),
      '',
      e.amount::numeric,
      e.agent_id,
      NULL,
      e.date::date,
      e.id,
      NULL,
      e.created_at
    FROM public.agent_expenses e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.unified_expenses u WHERE u.legacy_agent_expense_id = e.id
    );
  ELSE
    RAISE NOTICE '005_backfill: public.agent_expenses not found; skipping agent expense backfill.';
  END IF;

  IF to_regclass('public.general_expenses') IS NOT NULL THEN
    INSERT INTO public.unified_expenses (
      organization_id, scope, category, subcategory, amount, agent_id, product_id, occurred_at,
      legacy_general_expense_id, note, created_at
    )
    SELECT
      g.organization_id,
      'org',
      COALESCE(g.category, 'other'),
      COALESCE(g.subcategory, ''),
      g.amount::numeric,
      NULL,
      NULL, -- re-link product_id manually if legacy general_expenses used non-UUID ids
      g.date::date,
      g.id,
      NULL,
      g.created_at
    FROM public.general_expenses g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.unified_expenses u WHERE u.legacy_general_expense_id = g.id
    );
  ELSE
    RAISE NOTICE '005_backfill: public.general_expenses not found; skipping org expense backfill (use unified_expenses / app only).';
  END IF;
END
$ue$;
