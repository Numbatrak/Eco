-- Products stabilization: variants, typed offers, accord rule, metadata, deactivation

-- ---------------------------------------------------------------------------
-- Product metadata + capability toggles
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sub_brand text,
  ADD COLUMN IF NOT EXISTS allows_variants boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allows_bundles boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allows_discounts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.allows_variants IS 'When true, sellable SKUs live in product_variants';
COMMENT ON COLUMN public.products.allows_bundles IS 'When true, cross-product bundle offers are allowed';
COMMENT ON COLUMN public.products.allows_discounts IS 'When true, quantity-tier / buy-X-get-Y offers are allowed';

-- ---------------------------------------------------------------------------
-- Variants (first-class sellable SKUs under a parent product)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  base_price numeric(12,2) NOT NULL,
  cost_price numeric(12,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_prices_nonneg CHECK (base_price >= 0 AND cost_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_org
  ON public.product_variants (organization_id);

-- ---------------------------------------------------------------------------
-- Typed offers (separate axis from variants)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_offer_type') THEN
    CREATE TYPE public.product_offer_type AS ENUM (
      'single',
      'quantity_tier',
      'bundle',
      'buy_x_get_y'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  offer_type public.product_offer_type NOT NULL DEFAULT 'single',
  label text NOT NULL,
  min_quantity integer NOT NULL DEFAULT 1,
  free_quantity integer NOT NULL DEFAULT 0,
  bundle_items jsonb,
  price numeric(12,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_offers_quantities_nonneg CHECK (min_quantity > 0 AND free_quantity >= 0),
  CONSTRAINT product_offers_prices_nonneg CHECK (price >= 0 AND unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_offers_product
  ON public.product_offers (product_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_org
  ON public.product_offers (organization_id);

-- Optional variant scoping on inventory lots
ALTER TABLE public.inventory_lots
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Line-item snapshots: variant, offer, accord (true unit count)
-- ---------------------------------------------------------------------------
ALTER TABLE public.form_response_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.product_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_paid integer,
  ADD COLUMN IF NOT EXISTS free_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS true_unit_count integer;

ALTER TABLE public.customer_order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.product_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_paid integer,
  ADD COLUMN IF NOT EXISTS free_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS true_unit_count integer;

-- Relax cost CHECK to use true_unit_count (physical units for COGS)
ALTER TABLE public.form_response_items
  DROP CONSTRAINT IF EXISTS check_total_cost_calculation;
ALTER TABLE public.form_response_items
  ADD CONSTRAINT check_total_cost_calculation CHECK (
    total_cost = (COALESCE(true_unit_count, quantity)::numeric * unit_cost_at_submission)
  );

-- Paid quantity drives revenue; quantity column remains paid qty for backward compat
ALTER TABLE public.form_response_items
  DROP CONSTRAINT IF EXISTS check_total_price_calculation;
ALTER TABLE public.form_response_items
  ADD CONSTRAINT check_total_price_calculation CHECK (
    total_price = (COALESCE(quantity_paid, quantity)::numeric * unit_price_at_submission)
  );

-- Backfill accord columns on existing rows
UPDATE public.form_response_items
SET
  quantity_paid = quantity,
  true_unit_count = quantity
WHERE quantity_paid IS NULL OR true_unit_count IS NULL;

UPDATE public.customer_order_items
SET
  quantity_paid = quantity,
  true_unit_count = quantity
WHERE quantity_paid IS NULL OR true_unit_count IS NULL;

-- ---------------------------------------------------------------------------
-- RLS: variants + offers (mirror products org scoping)
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product_variants in their org"
  ON public.product_variants FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage product_variants in their org"
  ON public.product_variants TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['Owner'::text, 'Admin'::text, 'Manager'::text])
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['Owner'::text, 'Admin'::text, 'Manager'::text])
    )
  );

CREATE POLICY "Users can view product_offers in their org"
  ON public.product_offers FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage product_offers in their org"
  ON public.product_offers TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['Owner'::text, 'Admin'::text, 'Manager'::text])
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['Owner'::text, 'Admin'::text, 'Manager'::text])
    )
  );

-- Anon: only active products attached to active forms
DROP POLICY IF EXISTS "Public can view products for active forms" ON public.products;
CREATE POLICY "Public can view products for active forms"
  ON public.products FOR SELECT TO anon
  USING (
    active = true
    AND EXISTS (
      SELECT 1
      FROM public.form_products fp
      JOIN public.forms f ON f.id = fp.form_id
      WHERE fp.product_id = products.id AND f.active = true
    )
  );

-- ---------------------------------------------------------------------------
-- Order RPC: resolve offers + accord rule (true_unit_count for FIFO/COGS)
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
  INSERT INTO form_responses (
    organization_id, form_id, response_type, status, source, page_url,
    field_values, selected_products, raw_payload, normalized_payload, items,
    package, offer_name, submitted_at, submission_status
  )
  VALUES (
    p_organization_id, p_form_id, 'order', 'new', p_source, p_page_url,
    p_field_values, p_items, p_raw_payload, p_normalized_payload, p_items,
    p_package, p_offer_name, NOW(), 'raw_submission'
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

    -- Resolve economics from offer when present
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
      -- Variant override or product base pricing
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
  'Creates form_response order with FIFO inventory (accord true_unit_count), typed offers, status new.';
