-- Order data audit — run per organisation in Supabase SQL editor.
-- Replace the UUID below before executing.

\set org_id '00000000-0000-0000-0000-000000000000'

-- A1: Suspected test/demo orders
SELECT id, customer_name, phone_number, status, created_at, order_revenue, profit
FROM form_responses
WHERE organization_id = :'org_id'::uuid
  AND response_type = 'order'
  AND (
    lower(coalesce(customer_name, '')) ~ '(test|demo|sample|fake|xxx)'
    OR lower(coalesce(phone_number, '')) ~ '(test|demo|000000|111111)'
  )
ORDER BY created_at DESC;

-- A2: Empty shell orders (no customer identity)
SELECT fr.id, fr.status, fr.created_at
FROM form_responses fr
WHERE fr.organization_id = :'org_id'::uuid
  AND fr.response_type = 'order'
  AND coalesce(fr.customer_name, '') = ''
  AND coalesce(fr.phone_number, '') = ''
  AND NOT EXISTS (
    SELECT 1 FROM form_response_items i WHERE i.form_response_id = fr.id
  );

-- A3: Duplicate submissions (same phone + form within 1 minute)
SELECT a.id AS id_a, b.id AS id_b, a.phone_number, a.form_id, a.created_at
FROM form_responses a
JOIN form_responses b
  ON a.organization_id = b.organization_id
  AND a.form_id = b.form_id
  AND a.phone_number = b.phone_number
  AND a.id < b.id
  AND abs(extract(epoch FROM (a.created_at - b.created_at))) < 60
WHERE a.organization_id = :'org_id'::uuid
  AND a.response_type = 'order'
  AND b.response_type = 'order';

-- B1: Completed orders missing revenue snapshot
SELECT fr.id, fr.status, fr.order_revenue, fr.order_cost, fr.delivery_fee, fr.profit
FROM form_responses fr
WHERE fr.organization_id = :'org_id'::uuid
  AND fr.response_type = 'order'
  AND fr.status = 'completed'
  AND fr.order_revenue IS NULL;

-- B2: Completed with zero profit but positive revenue (likely mislabelled)
SELECT id, order_revenue, order_cost, delivery_fee, profit, completed_at
FROM form_responses
WHERE organization_id = :'org_id'::uuid
  AND response_type = 'order'
  AND status = 'completed'
  AND coalesce(order_revenue, 0) > 0
  AND coalesce(profit, 0) = 0;

-- B3: Completed without completed_at
SELECT id, status, created_at, updated_at, completed_at
FROM form_responses
WHERE organization_id = :'org_id'::uuid
  AND response_type = 'order'
  AND status = 'completed'
  AND completed_at IS NULL;

-- B4: Orphan customer_orders (form source, no linked response)
SELECT co.id, co.form_response_id, co.customer_name, co.created_at
FROM customer_orders co
WHERE co.organization_id = :'org_id'::uuid
  AND co.source = 'form'
  AND co.form_response_id IS NULL;

-- Summary counts for dashboard reconciliation
SELECT
  count(*) FILTER (WHERE response_type = 'order' AND status <> 'cancelled') AS generated_all_time,
  count(*) FILTER (WHERE response_type = 'order' AND status = 'completed') AS delivered_all_time,
  coalesce(sum(order_revenue) FILTER (WHERE status = 'completed'), 0) AS delivered_revenue,
  coalesce(sum(order_cost) FILTER (WHERE status = 'completed'), 0) AS delivered_cogs,
  coalesce(sum(delivery_fee) FILTER (WHERE status = 'completed'), 0) AS delivered_fees,
  coalesce(sum(profit) FILTER (WHERE status = 'completed'), 0) AS stored_profit_sum
FROM form_responses
WHERE organization_id = :'org_id'::uuid;
