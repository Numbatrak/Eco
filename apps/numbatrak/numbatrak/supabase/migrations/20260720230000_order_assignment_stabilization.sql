-- §13 Organization Settings & Order Assignment stabilization
-- Tables, round-robin / percentage RPCs, auto-assign CSR on form order intake.

-- ---------------------------------------------------------------------------
-- Assignment settings tables (from scripts/migrations/010)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_assignment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  assignment_method text NOT NULL DEFAULT 'round_robin'
    CHECK (assignment_method IN ('round_robin', 'percentage')),
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

ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS csr_id uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_responses_csr
  ON public.form_responses (organization_id, csr_id)
  WHERE csr_id IS NOT NULL;

COMMENT ON COLUMN public.form_responses.csr_id IS
  'Customer Relations rep assigned at intake; set by pick_csr_for_order_assignment.';

-- ---------------------------------------------------------------------------
-- Round-robin: next CSR after last_assigned_user_id, skipping excluded (is_paused)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_round_robin_user(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_last uuid;
  v_next uuid;
BEGIN
  SELECT last_assigned_user_id INTO v_last
  FROM public.order_assignment_settings
  WHERE organization_id = org_id;

  SELECT om.user_id INTO v_next
  FROM public.organization_members om
  LEFT JOIN public.order_assignment_weights w
    ON w.organization_id = org_id AND w.user_id = om.user_id
  WHERE om.organization_id = org_id
    AND om.role = 'Customer Relations'
    AND COALESCE(w.is_paused, false) = false
    AND (v_last IS NULL OR om.user_id > v_last)
  ORDER BY om.user_id
  LIMIT 1;

  IF v_next IS NULL THEN
    SELECT om.user_id INTO v_next
    FROM public.organization_members om
    LEFT JOIN public.order_assignment_weights w
      ON w.organization_id = org_id AND w.user_id = om.user_id
    WHERE om.organization_id = org_id
      AND om.role = 'Customer Relations'
      AND COALESCE(w.is_paused, false) = false
    ORDER BY om.user_id
    LIMIT 1;
  END IF;

  IF v_next IS NOT NULL THEN
    INSERT INTO public.order_assignment_settings (
      organization_id, assignment_method, last_assigned_user_id, updated_at
    )
    VALUES (org_id, 'round_robin', v_next, now())
    ON CONFLICT (organization_id) DO UPDATE
    SET last_assigned_user_id = EXCLUDED.last_assigned_user_id,
        updated_at = now();
  END IF;

  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.get_next_round_robin_user IS
  'Returns next Customer Relations user in rotation; updates last_assigned_user_id.';

-- ---------------------------------------------------------------------------
-- Percentage-weighted pick; falls back to round-robin when pool empty
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_percentage_assigned_user(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_total numeric;
  v_rand numeric;
  v_cum numeric := 0;
  r record;
  v_user uuid;
BEGIN
  SELECT COALESCE(SUM(w.percentage), 0) INTO v_total
  FROM public.order_assignment_weights w
  INNER JOIN public.organization_members om
    ON om.organization_id = w.organization_id
    AND om.user_id = w.user_id
    AND om.role = 'Customer Relations'
  WHERE w.organization_id = org_id
    AND w.is_paused = false
    AND w.percentage > 0;

  IF v_total <= 0 THEN
    RETURN public.get_next_round_robin_user(org_id);
  END IF;

  v_rand := random() * v_total;

  FOR r IN
    SELECT w.user_id, w.percentage
    FROM public.order_assignment_weights w
    INNER JOIN public.organization_members om
      ON om.organization_id = w.organization_id
      AND om.user_id = w.user_id
      AND om.role = 'Customer Relations'
    WHERE w.organization_id = org_id
      AND w.is_paused = false
      AND w.percentage > 0
    ORDER BY w.user_id
  LOOP
    v_cum := v_cum + r.percentage;
    IF v_rand <= v_cum THEN
      v_user := r.user_id;
      EXIT;
    END IF;
  END LOOP;

  RETURN v_user;
END;
$$;

COMMENT ON FUNCTION public.get_percentage_assigned_user IS
  'Weighted-random CSR pick from assignment pool; round-robin fallback.';

-- ---------------------------------------------------------------------------
-- Entry point for order intake
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pick_csr_for_order_assignment(p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_method text;
BEGIN
  SELECT assignment_method INTO v_method
  FROM public.order_assignment_settings
  WHERE organization_id = p_org_id;

  IF v_method IS NULL OR v_method = 'round_robin' THEN
    RETURN public.get_next_round_robin_user(p_org_id);
  END IF;

  RETURN public.get_percentage_assigned_user(p_org_id);
END;
$$;

COMMENT ON FUNCTION public.pick_csr_for_order_assignment IS
  'Auto-assign CSR for new orders based on org assignment settings.';

GRANT EXECUTE ON FUNCTION public.get_next_round_robin_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_percentage_assigned_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pick_csr_for_order_assignment(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Order RPC: assign csr_id at intake
-- ---------------------------------------------------------------------------
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
  v_csr_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_offer_id UUID;
  v_offer RECORD;
  v_bundle_item JSONB;
  v_quantity INT;
  v_quantity_paid INT;
  v_free_qty INT;
  v_true_unit_count INT;
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
  v_stock_product_id UUID;
BEGIN
  v_csr_id := public.pick_csr_for_order_assignment(p_organization_id);

  INSERT INTO form_responses (
    organization_id, form_id, response_type, status, source, page_url,
    field_values, selected_products, raw_payload, normalized_payload, items,
    package, offer_name, submitted_at, submission_status, csr_id
  )
  VALUES (
    p_organization_id, p_form_id, 'order', 'new', p_source, p_page_url,
    p_field_values, p_items, p_raw_payload, p_normalized_payload, p_items,
    p_package, p_offer_name, NOW(), 'raw_submission', v_csr_id
  )
  RETURNING id INTO v_response_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_lot_ids := '{}'; v_qtys := '{}'; v_costs := '{}';
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_offer_id := NULLIF(v_item->>'offer_id', '')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INT, 1);
    v_quantity_paid := COALESCE((v_item->>'quantity_paid')::INT, v_quantity);
    v_free_qty := COALESCE((v_item->>'free_quantity')::INT, 0);
    v_true_unit_count := COALESCE((v_item->>'true_unit_count')::INT, v_quantity_paid + v_free_qty);

    IF v_quantity_paid IS NULL OR v_quantity_paid <= 0 THEN
      RAISE EXCEPTION 'Invalid paid quantity for product %', v_product_id;
    END IF;
    IF v_true_unit_count IS NULL OR v_true_unit_count <= 0 THEN
      RAISE EXCEPTION 'Invalid true unit count for product %', v_product_id;
    END IF;

    IF v_offer_id IS NOT NULL THEN
      SELECT * INTO v_offer
      FROM product_offers
      WHERE id = v_offer_id
        AND organization_id = p_organization_id
        AND product_id = v_product_id
        AND active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW());

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Offer % not found or inactive for product %', v_offer_id, v_product_id;
      END IF;

      CASE v_offer.offer_type
        WHEN 'buy_x_get_y' THEN
          v_quantity_paid := v_quantity * v_offer.min_quantity;
          v_free_qty := v_quantity * v_offer.free_quantity;
          v_true_unit_count := v_quantity_paid + v_free_qty;
          v_unit_price := v_offer.price / NULLIF(v_offer.min_quantity, 0);
          v_cost_price := v_offer.unit_cost;
        WHEN 'quantity_tier' THEN
          v_quantity_paid := v_quantity;
          v_free_qty := 0;
          v_true_unit_count := v_quantity;
          v_unit_price := v_offer.price / NULLIF(GREATEST(v_offer.min_quantity, 1), 0);
          v_cost_price := v_offer.unit_cost;
        WHEN 'bundle' THEN
          v_quantity_paid := v_quantity;
          v_free_qty := 0;
          v_true_unit_count := v_quantity;
          v_unit_price := v_offer.price;
          v_cost_price := v_offer.unit_cost;
        ELSE
          v_quantity_paid := v_quantity;
          v_free_qty := 0;
          v_true_unit_count := v_quantity;
          v_unit_price := v_offer.price;
          v_cost_price := v_offer.unit_cost;
      END CASE;

      IF v_offer.variant_id IS NOT NULL THEN
        v_variant_id := v_offer.variant_id;
      END IF;
    ELSE
      IF v_variant_id IS NOT NULL THEN
        SELECT base_price, cost_price INTO v_unit_price, v_cost_price
        FROM product_variants
        WHERE id = v_variant_id
          AND product_id = v_product_id
          AND organization_id = p_organization_id
          AND active = true;
        IF v_unit_price IS NULL THEN
          RAISE EXCEPTION 'Variant % not found or inactive', v_variant_id;
        END IF;
      ELSE
        SELECT COALESCE(
          (SELECT price FROM product_price_history
           WHERE product_id = v_product_id AND ends_at IS NULL
           ORDER BY starts_at DESC LIMIT 1),
          (SELECT base_price FROM products WHERE id = v_product_id)
        ) INTO v_unit_price;
        SELECT COALESCE(
          (SELECT cost_price FROM product_price_history
           WHERE product_id = v_product_id AND ends_at IS NULL
           ORDER BY starts_at DESC LIMIT 1),
          (SELECT cost_price FROM products WHERE id = v_product_id)
        ) INTO v_cost_price;
      END IF;
    END IF;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'No price for product %', v_product_id;
    END IF;

    v_stock_product_id := v_product_id;

    SELECT (COALESCE(SUM(quantity_remaining), 0) > 0) INTO v_has_lots
    FROM inventory_lots
    WHERE organization_id = p_organization_id
      AND product_id = v_stock_product_id
      AND (
        (v_variant_id IS NULL AND variant_id IS NULL)
        OR variant_id = v_variant_id
      );

    IF NOT v_has_lots THEN
      v_line_total_cost := COALESCE(v_cost_price, 0) * v_true_unit_count;
      INSERT INTO form_response_items (
        form_response_id, product_id, variant_id, offer_id,
        quantity, quantity_paid, free_quantity, true_unit_count,
        unit_price_at_submission, unit_cost_at_submission,
        total_price, total_cost, profit
      )
      VALUES (
        v_response_id, v_product_id, v_variant_id, v_offer_id,
        v_quantity_paid, v_quantity_paid, v_free_qty, v_true_unit_count,
        v_unit_price, COALESCE(v_cost_price, 0),
        v_unit_price * v_quantity_paid, v_line_total_cost,
        (v_unit_price * v_quantity_paid) - v_line_total_cost
      );
      v_order_total_cost := v_order_total_cost + v_line_total_cost;
      v_order_total_revenue := v_order_total_revenue + (v_unit_price * v_quantity_paid);
      CONTINUE;
    END IF;

    v_remaining := v_true_unit_count;
    v_line_total_cost := 0;

    FOR v_lot IN
      SELECT id, quantity_remaining, unit_cost
      FROM inventory_lots
      WHERE organization_id = p_organization_id
        AND product_id = v_stock_product_id
        AND quantity_remaining > 0
        AND (
          (v_variant_id IS NULL AND variant_id IS NULL)
          OR variant_id = v_variant_id
        )
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
      RAISE EXCEPTION 'Insufficient inventory for product % (need %, short %)',
        v_product_id, v_true_unit_count, v_remaining;
    END IF;

    v_unit_cost_avg := v_line_total_cost / NULLIF(v_true_unit_count, 0);
    INSERT INTO form_response_items (
      form_response_id, product_id, variant_id, offer_id,
      quantity, quantity_paid, free_quantity, true_unit_count,
      unit_price_at_submission, unit_cost_at_submission,
      total_price, total_cost, profit
    )
    VALUES (
      v_response_id, v_product_id, v_variant_id, v_offer_id,
      v_quantity_paid, v_quantity_paid, v_free_qty, v_true_unit_count,
      v_unit_price, v_unit_cost_avg,
      v_unit_price * v_quantity_paid, v_line_total_cost,
      (v_unit_price * v_quantity_paid) - v_line_total_cost
    )
    RETURNING id INTO v_item_id;

    FOR v_i IN 1..array_length(v_lot_ids, 1)
    LOOP
      INSERT INTO order_inventory_consumption (
        organization_id, order_id, order_item_id, inventory_lot_id,
        quantity_consumed, unit_cost
      )
      VALUES (
        p_organization_id, v_response_id, v_item_id, v_lot_ids[v_i],
        v_qtys[v_i], v_costs[v_i]
      );
    END LOOP;

    v_order_total_cost := v_order_total_cost + v_line_total_cost;
    v_order_total_revenue := v_order_total_revenue + (v_unit_price * v_quantity_paid);
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
    status = 'new',
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = v_response_id;

  RETURN jsonb_build_object(
    'id', v_response_id,
    'csr_id', v_csr_id,
    'order_cost', v_order_total_cost,
    'order_revenue', v_order_total_revenue,
    'order_profit', public.compute_form_response_gross_profit(
      v_order_total_revenue,
      v_order_total_cost
    )
  );
END;
$$;

COMMENT ON FUNCTION public.create_order_from_normalized_submission IS
  'Creates form_response order with FIFO inventory, typed offers, CSR auto-assignment, status new.';
