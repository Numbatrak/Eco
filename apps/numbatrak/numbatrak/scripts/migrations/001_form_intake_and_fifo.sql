-- ============================================
-- FORM INTAKE & NORMALIZATION + FIFO INVENTORY
-- ============================================
-- Backward compatible: only creates/adds what does not exist.
-- Run in Supabase SQL Editor.
--
-- Canonical fields (every form submission normalized into these when possible):
-- first_name, last_name, phone, whatsapp, state, address, items, package, offer_name, submitted_at, site_url
-- ============================================

-- ---------------------------------------------------------------------------
-- 1. FORMS TABLE — add columns only if missing
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forms' AND column_name = 'site_url') THEN
    ALTER TABLE forms ADD COLUMN site_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forms' AND column_name = 'field_mapping') THEN
    ALTER TABLE forms ADD COLUMN field_mapping JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. FIELD_MAPPINGS TABLE — create only if not exists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_mappings_form_id ON field_mappings(form_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_organization_id ON field_mappings(organization_id);

-- ---------------------------------------------------------------------------
-- 3. FORM_RESPONSES — add columns only if missing (backward compatible)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'raw_payload') THEN
    ALTER TABLE form_responses ADD COLUMN raw_payload JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'normalized_payload') THEN
    ALTER TABLE form_responses ADD COLUMN normalized_payload JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'items') THEN
    ALTER TABLE form_responses ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'package') THEN
    ALTER TABLE form_responses ADD COLUMN package TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'offer_name') THEN
    ALTER TABLE form_responses ADD COLUMN offer_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'submitted_at') THEN
    ALTER TABLE form_responses ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'submission_status') THEN
    ALTER TABLE form_responses ADD COLUMN submission_status TEXT CHECK (submission_status IN ('raw_submission','abandoned_cart','order_created'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'order_cost') THEN
    ALTER TABLE form_responses ADD COLUMN order_cost NUMERIC(12, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'order_revenue') THEN
    ALTER TABLE form_responses ADD COLUMN order_revenue NUMERIC(12, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_responses' AND column_name = 'order_profit') THEN
    ALTER TABLE form_responses ADD COLUMN order_profit NUMERIC(12, 2);
  END IF;
END $$;

-- Indexes for form_responses (new columns)
CREATE INDEX IF NOT EXISTS idx_form_responses_submission_status ON form_responses(submission_status);
CREATE INDEX IF NOT EXISTS idx_form_responses_raw_payload_gin ON form_responses USING GIN (raw_payload);
-- organization_id, form_id indexes already exist in create-form-responses-schema.sql

-- ---------------------------------------------------------------------------
-- 4. INVENTORY_LOTS — create only if not exists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost NUMERIC(12, 2) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_organization_id ON inventory_lots(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_product_id ON inventory_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_received_at ON inventory_lots(organization_id, product_id, received_at ASC);

-- ---------------------------------------------------------------------------
-- 5. ORDER_INVENTORY_CONSUMPTION — create only if not exists
-- ---------------------------------------------------------------------------
-- Links form_response (order) and form_response_items to consumed lots (FIFO)
CREATE TABLE IF NOT EXISTS order_inventory_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES form_response_items(id) ON DELETE CASCADE,
  inventory_lot_id UUID NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
  quantity_consumed INTEGER NOT NULL CHECK (quantity_consumed > 0),
  unit_cost NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_inventory_consumption_organization_id ON order_inventory_consumption(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_inventory_consumption_order_id ON order_inventory_consumption(order_id);
CREATE INDEX IF NOT EXISTS idx_order_inventory_consumption_lot_id ON order_inventory_consumption(inventory_lot_id);

-- ---------------------------------------------------------------------------
-- 6. RPC: Create order from normalized submission (FIFO, single transaction)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_order_from_normalized_submission(
  p_organization_id UUID,
  p_form_id UUID,
  p_source TEXT DEFAULT 'wordpress',
  p_page_url TEXT DEFAULT NULL,
  p_field_values JSONB DEFAULT '{}'::jsonb,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_raw_payload JSONB DEFAULT '{}'::jsonb,
  p_normalized_payload JSONB DEFAULT '{}'::jsonb,
  p_package TEXT DEFAULT NULL,
  p_offer_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- Insert form_response (submission_status set to order_created at end)
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

    -- Current selling price (revenue) and cost (for snapshot fallback)
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

    -- If no inventory_lots for this product, use snapshot cost (backward compatible)
    SELECT (COALESCE(SUM(quantity_remaining), 0) > 0) INTO v_has_lots
    FROM inventory_lots
    WHERE organization_id = p_organization_id AND product_id = v_product_id;

    IF NOT v_has_lots THEN
      -- Snapshot cost: no FIFO, no order_inventory_consumption
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
      CONTINUE;
    END IF;

    -- FIFO: lock lots and consume, record consumptions for order_inventory_consumption
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

    -- One form_response_item per line (FIFO-derived cost)
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

    -- Insert order_inventory_consumption rows for this line
    FOR v_i IN 1..array_length(v_lot_ids, 1)
    LOOP
      INSERT INTO order_inventory_consumption (
        organization_id, order_id, order_item_id, inventory_lot_id, quantity_consumed, unit_cost
      )
      VALUES (
        p_organization_id, v_response_id, v_item_id, v_lot_ids[v_i], v_qtys[v_i], v_costs[v_i]
      );
    END LOOP;
  END LOOP;

  -- Recompute totals from inserted items
  SELECT
    COALESCE(SUM(total_cost), 0),
    COALESCE(SUM(total_price), 0)
  INTO v_order_total_cost, v_order_total_revenue
  FROM form_response_items
  WHERE form_response_id = v_response_id;

  UPDATE form_responses
  SET
    order_cost = v_order_total_cost,
    order_revenue = v_order_total_revenue,
    order_profit = v_order_total_revenue - v_order_total_cost,
    submission_status = 'order_created',
    status = 'pending',
    profit = v_order_total_revenue - v_order_total_cost,
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = v_response_id;

  RETURN jsonb_build_object('id', v_response_id, 'order_cost', v_order_total_cost, 'order_revenue', v_order_total_revenue, 'order_profit', v_order_total_revenue - v_order_total_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION create_order_from_normalized_submission(UUID, UUID, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT) TO service_role;

-- Ensure update_updated_at_column exists (may already exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at on new tables
DROP TRIGGER IF EXISTS update_field_mappings_updated_at ON field_mappings;
CREATE TRIGGER update_field_mappings_updated_at
  BEFORE UPDATE ON field_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_lots_updated_at ON inventory_lots;
CREATE TRIGGER update_inventory_lots_updated_at
  BEFORE UPDATE ON inventory_lots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for new tables (organization-scoped)
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_inventory_consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view field_mappings in their org" ON field_mappings;
CREATE POLICY "Users can view field_mappings in their org" ON field_mappings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage field_mappings in their org" ON field_mappings;
CREATE POLICY "Users can manage field_mappings in their org" ON field_mappings FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view inventory_lots in their org" ON inventory_lots;
CREATE POLICY "Users can view inventory_lots in their org" ON inventory_lots FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage inventory_lots in their org" ON inventory_lots;
CREATE POLICY "Users can manage inventory_lots in their org" ON inventory_lots FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view order_inventory_consumption in their org" ON order_inventory_consumption;
CREATE POLICY "Users can view order_inventory_consumption in their org" ON order_inventory_consumption FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- Service role can insert/update for Edge Function
DROP POLICY IF EXISTS "Service role full access order_inventory_consumption" ON order_inventory_consumption;
CREATE POLICY "Service role full access order_inventory_consumption" ON order_inventory_consumption FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access inventory_lots" ON inventory_lots;
CREATE POLICY "Service role full access inventory_lots" ON inventory_lots FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
BEGIN
  RAISE NOTICE 'Form intake & FIFO migration applied successfully.';
END $$;
