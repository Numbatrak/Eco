-- ============================================
-- FRESH START - Complete Reset (Non-Production)
-- ============================================
-- This script drops old tables and creates new ones in one go
-- WARNING: This will DELETE ALL DATA!
-- Only use this for development/testing environments
-- ============================================

-- Step 1: Drop old tables
-- ============================================

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS abandoned_carts CASCADE;
DROP TABLE IF EXISTS form_incentives CASCADE;
DROP TABLE IF EXISTS form_products CASCADE;
DROP TABLE IF EXISTS forms CASCADE;
DROP TABLE IF EXISTS product_price_history CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Step 2: Create new tables
-- ============================================

-- Products Table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  type TEXT NOT NULL DEFAULT 'NORMAL' CHECK (type IN ('NORMAL', 'INCENTIVE')),
  base_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_type ON products(type);

-- Product Price History
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_price_history_product_id ON product_price_history(product_id);
CREATE INDEX idx_product_price_history_active ON product_price_history(product_id, ends_at) WHERE ends_at IS NULL;

-- Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'wordpress',
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_organization_id ON orders(organization_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price_at_order DECIMAL(10, 2) NOT NULL,
  unit_cost_at_order DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  profit DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

ALTER TABLE order_items 
ADD CONSTRAINT check_profit_calculation 
CHECK (profit = (total_price - total_cost));

ALTER TABLE order_items 
ADD CONSTRAINT check_total_price_calculation 
CHECK (total_price = (quantity * unit_price_at_order));

ALTER TABLE order_items 
ADD CONSTRAINT check_total_cost_calculation 
CHECK (total_cost = (quantity * unit_cost_at_order));

-- Forms
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  form_token TEXT NOT NULL UNIQUE,
  schema JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forms_organization_id ON forms(organization_id);
CREATE INDEX idx_forms_token ON forms(form_token);
CREATE INDEX idx_forms_active ON forms(active);

-- Form Products
CREATE TABLE form_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  required BOOLEAN DEFAULT FALSE,
  pricing_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_mode IN ('fixed', 'selectable')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(form_id, product_id)
);

CREATE INDEX idx_form_products_form_id ON form_products(form_id);
CREATE INDEX idx_form_products_product_id ON form_products(product_id);

-- Form Incentives
CREATE TABLE form_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  trigger_condition JSONB,
  auto_apply BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(form_id, product_id)
);

CREATE INDEX idx_form_incentives_form_id ON form_incentives(form_id);
CREATE INDEX idx_form_incentives_product_id ON form_incentives(product_id);

-- Abandoned Carts
CREATE TABLE abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
  page_url TEXT,
  filled_fields JSONB,
  field_values JSONB,
  selected_products JSONB,
  converted_to_order BOOLEAN DEFAULT FALSE,
  converted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  abandoned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_abandoned_carts_organization_id ON abandoned_carts(organization_id);
CREATE INDEX idx_abandoned_carts_form_id ON abandoned_carts(form_id);
CREATE INDEX idx_abandoned_carts_converted ON abandoned_carts(converted_to_order);
CREATE INDEX idx_abandoned_carts_abandoned_at ON abandoned_carts(abandoned_at);

-- Step 3: Create triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_abandoned_carts_updated_at
  BEFORE UPDATE ON abandoned_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Verification
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fresh start complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'All old tables dropped and new tables created.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run RLS policies: scripts/rls-policies-orders-forms.sql';
  RAISE NOTICE '2. Deploy Edge Function';
  RAISE NOTICE '3. Host embed SDK files';
  RAISE NOTICE '4. Install WordPress plugin';
END $$;
