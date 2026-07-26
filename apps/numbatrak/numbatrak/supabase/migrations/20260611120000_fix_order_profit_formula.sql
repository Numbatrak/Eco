-- Order profit: gross margin (order_profit) vs net after delivery (profit).
-- Line-item profit remains total_price - total_cost (FIFO snapshot).

CREATE OR REPLACE FUNCTION public.compute_form_response_gross_profit(
  p_order_revenue NUMERIC,
  p_order_cost NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_order_revenue, 0) - COALESCE(p_order_cost, 0);
$$;

CREATE OR REPLACE FUNCTION public.compute_form_response_net_profit(
  p_order_revenue NUMERIC,
  p_order_cost NUMERIC,
  p_delivery_fee NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_order_revenue, 0)
       - COALESCE(p_order_cost, 0)
       - COALESCE(p_delivery_fee, 0);
$$;

CREATE OR REPLACE FUNCTION public.create_order_from_normalized_submission(
  p_organization_id UUID,
  p_form_id UUID,
  p_source TEXT DEFAULT 'wordpress',
  p_page_url TEXT DEFAULT NULL,
  p_field_values JSONB DEFAULT '{}',
  p_items JSONB DEFAULT '[]',
  p_raw_payload JSONB DEFAULT '{}',
  p_normalized_payload JSONB DEFAULT '{}',
  p_package TEXT DEFAULT NULL,
  p_offer_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_response_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INT;
  v_remaining INT;
  v_lot RECORD;
  v_consumed INT;
  v_line_total_cost NUMERIC(12,2);
  v_unit_price NUMERIC(12,2);
  v_cost_price NUMERIC(12,2);
  v_item_id UUID;
  v_order_total_cost NUMERIC(12,2) := 0;
  v_order_total_revenue NUMERIC(12,2) := 0;
  v_unit_cost_avg NUMERIC(12,2);
  v_lot_ids UUID[] := '{}';
  v_qtys INT[] := '{}';
  v_costs NUMERIC[] := '{}';
  v_i INT;
  v_has_lots BOOLEAN;
BEGIN
  INSERT INTO form_responses (
    organization_id, form_id, response_type, status, source, page_url,
    field_values, selected_products, raw_payload, normalized_payload, items,
    package, offer_name, submitted_at, submission_status
  )
  VALUES (
    p_organization_id, p_form_id, 'order', 'pending', p_source, p_page_url,
    p_field_values, p_items, p_raw_payload, p_normalized_payload, p_items,
    p_package, p_offer_name, NOW(), 'raw_submission'
  )
  RETURNING id INTO v_response_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_lot_ids := '{}'; v_qtys := '{}'; v_costs := '{}';
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_product_id;
    END IF;

    SELECT COALESCE(
      (SELECT price FROM product_price_history WHERE product_id = v_product_id AND ends_at IS NULL ORDER BY starts_at DESC LIMIT 1),
      (SELECT base_price FROM products WHERE id = v_product_id)
    ) INTO v_unit_price;
    SELECT COALESCE(
      (SELECT cost_price FROM product_price_history WHERE product_id = v_product_id AND ends_at IS NULL ORDER BY starts_at DESC LIMIT 1),
      (SELECT cost_price FROM products WHERE id = v_product_id)
    ) INTO v_cost_price;
    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'No price for product %', v_product_id;
    END IF;

    SELECT (COALESCE(SUM(quantity_remaining), 0) > 0) INTO v_has_lots
    FROM inventory_lots
    WHERE organization_id = p_organization_id AND product_id = v_product_id;

    IF NOT v_has_lots THEN
      v_line_total_cost := COALESCE(v_cost_price, 0) * v_quantity;
      INSERT INTO form_response_items (
        form_response_id, product_id, quantity,
        unit_price_at_submission, unit_cost_at_submission, total_price, total_cost, profit
      )
      VALUES (
        v_response_id, v_product_id, v_quantity,
        v_unit_price, COALESCE(v_cost_price, 0),
        v_unit_price * v_quantity, v_line_total_cost,
        (v_unit_price * v_quantity) - v_line_total_cost
      );
      v_order_total_cost := v_order_total_cost + v_line_total_cost;
      v_order_total_revenue := v_order_total_revenue + (v_unit_price * v_quantity);
      CONTINUE;
    END IF;

    v_remaining := v_quantity;
    v_line_total_cost := 0;

    FOR v_lot IN
      SELECT id, quantity_remaining, unit_cost
      FROM inventory_lots
      WHERE organization_id = p_organization_id AND product_id = v_product_id AND quantity_remaining > 0
      ORDER BY received_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_consumed := LEAST(v_remaining, v_lot.quantity_remaining);
      IF v_consumed <= 0 THEN EXIT; END IF;

      v_line_total_cost := v_line_total_cost + (v_consumed * v_lot.unit_cost);
      v_remaining := v_remaining - v_consumed;
      v_lot_ids := array_append(v_lot_ids, v_lot.id);
      v_qtys := array_append(v_qtys, v_consumed);
      v_costs := array_append(v_costs, v_lot.unit_cost);

      UPDATE inventory_lots
      SET quantity_remaining = quantity_remaining - v_consumed, updated_at = NOW()
      WHERE id = v_lot.id;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient inventory for product % (need %, short %)', v_product_id, v_quantity, v_remaining;
    END IF;

    v_unit_cost_avg := v_line_total_cost / NULLIF(v_quantity, 0);
    INSERT INTO form_response_items (
      form_response_id, product_id, quantity,
      unit_price_at_submission, unit_cost_at_submission, total_price, total_cost, profit
    )
    VALUES (
      v_response_id, v_product_id, v_quantity,
      v_unit_price, v_unit_cost_avg,
      v_unit_price * v_quantity, v_line_total_cost,
      (v_unit_price * v_quantity) - v_line_total_cost
    )
    RETURNING id INTO v_item_id;

    FOR v_i IN 1..array_length(v_lot_ids, 1)
    LOOP
      INSERT INTO order_inventory_consumption (
        organization_id, order_id, order_item_id, inventory_lot_id, quantity_consumed, unit_cost
      )
      VALUES (
        p_organization_id, v_response_id, v_item_id, v_lot_ids[v_i], v_qtys[v_i], v_costs[v_i]
      );
    END LOOP;

    v_order_total_cost := v_order_total_cost + v_line_total_cost;
    v_order_total_revenue := v_order_total_revenue + (v_unit_price * v_quantity);
  END LOOP;

  UPDATE form_responses
  SET
    order_cost = v_order_total_cost,
    order_revenue = v_order_total_revenue,
    order_profit = public.compute_form_response_gross_profit(
      v_order_total_revenue,
      v_order_total_cost
    ),
    submission_status = 'order_created',
    status = 'pending',
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = v_response_id;

  RETURN jsonb_build_object(
    'id', v_response_id,
    'order_cost', v_order_total_cost,
    'order_revenue', v_order_total_revenue,
    'order_profit', public.compute_form_response_gross_profit(
      v_order_total_revenue,
      v_order_total_cost
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_form_response_constants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_revenue NUMERIC;
  v_item_cost NUMERIC;
BEGIN
  NEW.phone_number := COALESCE(
    NEW.field_values->>'customer_phone',
    NEW.field_values->>'phone_number',
    NEW.field_values->>'whatsapp_number',
    NEW.field_values->>'phone'
  );
  NEW.package_name := COALESCE(
    NEW.field_values->>'package_name',
    NEW.field_values->>'selected_package',
    NEW.field_values->>'package',
    NEW.field_values->>'package_type'
  );
  NEW.customer_name := COALESCE(
    NEW.field_values->>'customer_name',
    NEW.field_values->>'name',
    CONCAT(
      COALESCE(NEW.field_values->>'first_name', ''),
      ' ',
      COALESCE(NEW.field_values->>'last_name', '')
    )
  );

  IF NEW.status = 'completed' THEN
    IF NEW.id IS NOT NULL THEN
      SELECT COALESCE(SUM(total_price), 0), COALESCE(SUM(total_cost), 0)
      INTO v_item_revenue, v_item_cost
      FROM form_response_items
      WHERE form_response_id = NEW.id;
    ELSE
      v_item_revenue := 0;
      v_item_cost := 0;
    END IF;

    NEW.order_profit := public.compute_form_response_gross_profit(
      COALESCE(NEW.order_revenue, v_item_revenue),
      COALESCE(NEW.order_cost, v_item_cost)
    );
    NEW.profit := public.compute_form_response_net_profit(
      COALESCE(NEW.order_revenue, v_item_revenue),
      COALESCE(NEW.order_cost, v_item_cost),
      NEW.delivery_fee
    );

    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  ELSE
    NEW.profit := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_form_response_profit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_response_id UUID;
  v_item_revenue NUMERIC;
  v_item_cost NUMERIC;
BEGIN
  v_response_id := COALESCE(NEW.form_response_id, OLD.form_response_id);

  SELECT COALESCE(SUM(total_price), 0), COALESCE(SUM(total_cost), 0)
  INTO v_item_revenue, v_item_cost
  FROM form_response_items
  WHERE form_response_id = v_response_id;

  UPDATE form_responses fr
  SET
    order_profit = public.compute_form_response_gross_profit(
      COALESCE(fr.order_revenue, v_item_revenue),
      COALESCE(fr.order_cost, v_item_cost)
    ),
    profit = public.compute_form_response_net_profit(
      COALESCE(fr.order_revenue, v_item_revenue),
      COALESCE(fr.order_cost, v_item_cost),
      fr.delivery_fee
    )
  WHERE fr.id = v_response_id
    AND fr.status = 'completed';

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Backfill completed orders: gross order_profit, net profit after delivery.
UPDATE form_responses fr
SET
  order_profit = public.compute_form_response_gross_profit(calc.rev, calc.cst),
  profit = public.compute_form_response_net_profit(calc.rev, calc.cst, fr.delivery_fee)
FROM (
  SELECT
    fr_inner.id,
    COALESCE(fr_inner.order_revenue, items.rev, 0)::numeric AS rev,
    COALESCE(fr_inner.order_cost, items.cst, 0)::numeric AS cst
  FROM form_responses fr_inner
  LEFT JOIN (
    SELECT
      form_response_id,
      SUM(total_price) AS rev,
      SUM(total_cost) AS cst
    FROM form_response_items
    GROUP BY form_response_id
  ) items ON items.form_response_id = fr_inner.id
  WHERE fr_inner.status = 'completed'
) calc
WHERE fr.id = calc.id;

COMMENT ON FUNCTION public.compute_form_response_gross_profit IS
  'Gross order margin: order_revenue - order_cost (stored in order_profit).';
COMMENT ON FUNCTION public.compute_form_response_net_profit IS
  'Net order profit: order_revenue - order_cost - delivery_fee (stored in profit). amount_paid is not included.';
