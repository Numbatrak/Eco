-- ============================================
-- FORM RESPONSES, FIFO INVENTORY & EDGE FUNCTION DEPENDENCIES
-- ============================================
-- Run this AFTER fresh-start.sql and rls-policies-orders-forms.sql
-- Creates everything the create-order-from-form Edge Function needs.
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================

-- ---------------------------------------------------------------------------
-- 1. FORMS TABLE — add missing columns for Edge Function
-- ---------------------------------------------------------------------------
ALTER TABLE forms ADD COLUMN IF NOT EXISTS site_url TEXT;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS field_mapping JSONB DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. FORM_RESPONSES TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
  response_type TEXT NOT NULL DEFAULT 'order' CHECK (response_type IN ('order', 'abandoned_cart')),
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT DEFAULT 'wordpress',
  page_url TEXT,
  field_values JSONB DEFAULT '{}'::jsonb,
  selected_products JSONB DEFAULT '[]'::jsonb,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  normalized_payload JSONB DEFAULT '{}'::jsonb,
  items JSONB DEFAULT '[]'::jsonb,
  package TEXT,
  offer_name TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submission_status TEXT CHECK (submission_status IN ('raw_submission', 'abandoned_cart', 'order_created')),
  order_cost NUMERIC(12, 2),
  order_revenue NUMERIC(12, 2),
  order_profit NUMERIC(12, 2),
  profit NUMERIC(12, 2),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  delivery_fee NUMERIC(12, 2),
  amount_paid NUMERIC(12, 2),
  agent_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (handles pre-existing table missing columns)
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS response_type TEXT NOT NULL DEFAULT 'order';
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'wordpress';
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS page_url TEXT;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS field_values JSONB DEFAULT '{}'::jsonb;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS selected_products JSONB DEFAULT '[]'::jsonb;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS normalized_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS package TEXT;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS offer_name TEXT;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS submission_status TEXT;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS order_cost NUMERIC(12, 2);
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS order_revenue NUMERIC(12, 2);
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS order_profit NUMERIC(12, 2);
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS profit NUMERIC(12, 2);
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 2);
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2);
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_form_responses_organization_id ON form_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_status ON form_responses(status);
CREATE INDEX IF NOT EXISTS idx_form_responses_response_type ON form_responses(response_type);
CREATE INDEX IF NOT EXISTS idx_form_responses_submission_status ON form_responses(submission_status);
CREATE INDEX IF NOT EXISTS idx_form_responses_created_at ON form_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_form_responses_raw_payload_gin ON form_responses USING GIN (raw_payload);

-- ---------------------------------------------------------------------------
-- 3. FORM_RESPONSE_ITEMS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_response_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price_at_submission NUMERIC(12, 2) NOT NULL,
  unit_cost_at_submission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 2) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (handles pre-existing table missing columns)
ALTER TABLE form_response_items ADD COLUMN IF NOT EXISTS unit_cost_at_submission NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE form_response_items ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE form_response_items ADD COLUMN IF NOT EXISTS profit NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_form_response_items_response_id ON form_response_items(form_response_id);
CREATE INDEX IF NOT EXISTS idx_form_response_items_product_id ON form_response_items(product_id);

-- ---------------------------------------------------------------------------
-- 4. FIELD_MAPPINGS TABLE
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
-- 5. INVENTORY_LOTS TABLE (FIFO)
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
-- 6. ORDER_INVENTORY_CONSUMPTION TABLE (FIFO tracking)
-- ---------------------------------------------------------------------------
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
-- 7. RPC: Create order from normalized submission (FIFO, single transaction)
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
    order_profit = v_order_total_revenue - v_order_total_cost,
    submission_status = 'order_created',
    status = 'pending',
    profit = v_order_total_revenue - v_order_total_cost,
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = v_response_id;

  RETURN jsonb_build_object(
    'id', v_response_id,
    'order_cost', v_order_total_cost,
    'order_revenue', v_order_total_revenue,
    'order_profit', v_order_total_revenue - v_order_total_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_order_from_normalized_submission(UUID, UUID, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. TRIGGERS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_form_responses_updated_at ON form_responses;
CREATE TRIGGER update_form_responses_updated_at
  BEFORE UPDATE ON form_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_field_mappings_updated_at ON field_mappings;
CREATE TRIGGER update_field_mappings_updated_at
  BEFORE UPDATE ON field_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_lots_updated_at ON inventory_lots;
CREATE TRIGGER update_inventory_lots_updated_at
  BEFORE UPDATE ON inventory_lots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9. RLS POLICIES
-- ---------------------------------------------------------------------------

-- form_responses
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view form_responses in their org" ON form_responses;
CREATE POLICY "Users can view form_responses in their org" ON form_responses FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage form_responses in their org" ON form_responses;
CREATE POLICY "Users can manage form_responses in their org" ON form_responses FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access form_responses" ON form_responses;
CREATE POLICY "Service role full access form_responses" ON form_responses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- form_response_items
ALTER TABLE form_response_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view form_response_items in their org" ON form_response_items;
CREATE POLICY "Users can view form_response_items in their org" ON form_response_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM form_responses fr
    WHERE fr.id = form_response_items.form_response_id
    AND fr.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Service role full access form_response_items" ON form_response_items;
CREATE POLICY "Service role full access form_response_items" ON form_response_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- field_mappings
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view field_mappings in their org" ON field_mappings;
CREATE POLICY "Users can view field_mappings in their org" ON field_mappings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage field_mappings in their org" ON field_mappings;
CREATE POLICY "Users can manage field_mappings in their org" ON field_mappings FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- inventory_lots
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view inventory_lots in their org" ON inventory_lots;
CREATE POLICY "Users can view inventory_lots in their org" ON inventory_lots FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage inventory_lots in their org" ON inventory_lots;
CREATE POLICY "Users can manage inventory_lots in their org" ON inventory_lots FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- order_inventory_consumption
ALTER TABLE order_inventory_consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order_inventory_consumption in their org" ON order_inventory_consumption;
CREATE POLICY "Users can view order_inventory_consumption in their org" ON order_inventory_consumption FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access order_inventory_consumption" ON order_inventory_consumption;
CREATE POLICY "Service role full access order_inventory_consumption" ON order_inventory_consumption FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access inventory_lots" ON inventory_lots;
CREATE POLICY "Service role full access inventory_lots" ON inventory_lots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 10. GRANTS
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON form_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON form_response_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON field_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_lots TO authenticated;
GRANT SELECT ON order_inventory_consumption TO authenticated;

GRANT ALL ON form_responses TO service_role;
GRANT ALL ON form_response_items TO service_role;
GRANT ALL ON inventory_lots TO service_role;
GRANT ALL ON order_inventory_consumption TO service_role;

-- ---------------------------------------------------------------------------
-- DONE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✅ Form responses, FIFO inventory, and Edge Function dependencies created successfully.';
  RAISE NOTICE 'The create-order-from-form Edge Function should now work.';
END $$;
