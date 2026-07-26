-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- Orders, Order Items, Abandoned Carts, and Forms
-- ============================================
-- 
-- These policies enforce organization-scoped access using helper functions
-- that bypass RLS to prevent infinite recursion.
--
-- Prerequisites:
-- - Helper functions must exist: is_org_member(), has_org_role(), has_any_org_role()
-- - Tables must have organization_id column
-- - RLS must be enabled on all tables
-- ============================================

-- ============================================
-- ORDERS TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view orders in their organization" ON orders;
DROP POLICY IF EXISTS "Users can create orders in their organization" ON orders;
DROP POLICY IF EXISTS "Users can update orders in their organization" ON orders;
DROP POLICY IF EXISTS "Users can delete orders in their organization" ON orders;
DROP POLICY IF EXISTS "Public can create orders via form token" ON orders;

-- SELECT: Users can view orders in their organization
CREATE POLICY "Users can view orders in their organization"
  ON orders FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Alternative using helper function (more efficient)
-- CREATE POLICY "Users can view orders in their organization"
--   ON orders FOR SELECT
--   TO authenticated
--   USING (is_org_member(organization_id));

-- INSERT: Users can create orders in their organization
-- Note: Edge Function uses service role key, so this is for direct API access
CREATE POLICY "Users can create orders in their organization"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Public can create orders via form token (for embed SDK)
-- This allows anonymous users to submit orders through forms
-- The Edge Function validates the form_token and organization
CREATE POLICY "Public can create orders via form token"
  ON orders FOR INSERT
  TO anon
  WITH CHECK (true); -- Edge Function validates organization_id

-- UPDATE: Users can update orders in their organization
-- Only Owners, Admins, and Managers can update orders
CREATE POLICY "Users can update orders in their organization"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  )
  WITH CHECK (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  );

-- DELETE: Only Owners and Admins can delete orders
CREATE POLICY "Users can delete orders in their organization"
  ON orders FOR DELETE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin'])
  );

-- ============================================
-- ORDER_ITEMS TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view order items in their organization" ON order_items;
DROP POLICY IF EXISTS "Users can create order items in their organization" ON order_items;
DROP POLICY IF EXISTS "Users can update order items in their organization" ON order_items;
DROP POLICY IF EXISTS "Users can delete order items in their organization" ON order_items;
DROP POLICY IF EXISTS "Public can create order items via form token" ON order_items;

-- SELECT: Users can view order items for orders in their organization
CREATE POLICY "Users can view order items in their organization"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: Users can create order items for orders in their organization
CREATE POLICY "Users can create order items in their organization"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: Public can create order items via form token (for embed SDK)
-- Edge Function validates the order belongs to correct organization
CREATE POLICY "Public can create order items via form token"
  ON order_items FOR INSERT
  TO anon
  WITH CHECK (true); -- Edge Function validates order_id

-- UPDATE: Only Owners, Admins, and Managers can update order items
CREATE POLICY "Users can update order items in their organization"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND has_any_org_role(o.organization_id, ARRAY['Owner', 'Admin', 'Manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND has_any_org_role(o.organization_id, ARRAY['Owner', 'Admin', 'Manager'])
    )
  );

-- DELETE: Only Owners and Admins can delete order items
CREATE POLICY "Users can delete order items in their organization"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND has_any_org_role(o.organization_id, ARRAY['Owner', 'Admin'])
    )
  );

-- ============================================
-- ABANDONED_CARTS TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view abandoned carts in their organization" ON abandoned_carts;
DROP POLICY IF EXISTS "Public can insert abandoned carts" ON abandoned_carts;
DROP POLICY IF EXISTS "Users can insert abandoned carts in their organization" ON abandoned_carts;
DROP POLICY IF EXISTS "Users can update abandoned carts in their organization" ON abandoned_carts;
DROP POLICY IF EXISTS "Users can delete abandoned carts in their organization" ON abandoned_carts;

-- SELECT: Users can view abandoned carts in their organization
CREATE POLICY "Users can view abandoned carts in their organization"
  ON abandoned_carts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Public can insert abandoned carts (for embed SDK)
-- This allows anonymous users to submit abandoned cart events
-- The form_id is validated by the embed SDK
CREATE POLICY "Public can insert abandoned carts"
  ON abandoned_carts FOR INSERT
  TO anon
  WITH CHECK (true); -- Embed SDK validates form_id and organization

-- INSERT: Authenticated users can also insert (for manual tracking)
CREATE POLICY "Users can insert abandoned carts in their organization"
  ON abandoned_carts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Only Owners, Admins, and Managers can update abandoned carts
-- Useful for marking as converted, adding notes, etc.
CREATE POLICY "Users can update abandoned carts in their organization"
  ON abandoned_carts FOR UPDATE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  )
  WITH CHECK (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  );

-- DELETE: Only Owners and Admins can delete abandoned carts
CREATE POLICY "Users can delete abandoned carts in their organization"
  ON abandoned_carts FOR DELETE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin'])
  );

-- ============================================
-- FORMS TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Public can view forms by token" ON forms;
DROP POLICY IF EXISTS "Users can view forms in their organization" ON forms;
DROP POLICY IF EXISTS "Users can create forms in their organization" ON forms;
DROP POLICY IF EXISTS "Users can update forms in their organization" ON forms;
DROP POLICY IF EXISTS "Users can delete forms in their organization" ON forms;

-- SELECT: Public can view forms by token (for embed SDK)
-- This allows anonymous users to fetch form schemas using form_token
-- Only active forms are accessible
CREATE POLICY "Public can view forms by token"
  ON forms FOR SELECT
  TO anon
  USING (active = true); -- Only active forms are publicly readable

-- SELECT: Users can view all forms in their organization
CREATE POLICY "Users can view forms in their organization"
  ON forms FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Only Owners, Admins, and Managers can create forms
CREATE POLICY "Users can create forms in their organization"
  ON forms FOR INSERT
  TO authenticated
  WITH CHECK (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  );

-- UPDATE: Only Owners, Admins, and Managers can update forms
CREATE POLICY "Users can update forms in their organization"
  ON forms FOR UPDATE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  )
  WITH CHECK (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  );

-- DELETE: Only Owners and Admins can delete forms
CREATE POLICY "Users can delete forms in their organization"
  ON forms FOR DELETE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin'])
  );

-- ============================================
-- FORM_PRODUCTS TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE form_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view form products in their organization" ON form_products;
DROP POLICY IF EXISTS "Public can view form products by form token" ON form_products;
DROP POLICY IF EXISTS "Users can manage form products in their organization" ON form_products;

-- SELECT: Public can view form products for active forms (for embed SDK)
CREATE POLICY "Public can view form products by form token"
  ON form_products FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_products.form_id
      AND f.active = true
    )
  );

-- SELECT: Users can view form products in their organization
CREATE POLICY "Users can view form products in their organization"
  ON form_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_products.form_id
      AND f.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT/UPDATE/DELETE: Only Owners, Admins, and Managers can manage form products
CREATE POLICY "Users can manage form products in their organization"
  ON form_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_products.form_id
      AND has_any_org_role(f.organization_id, ARRAY['Owner', 'Admin', 'Manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_products.form_id
      AND has_any_org_role(f.organization_id, ARRAY['Owner', 'Admin', 'Manager'])
    )
  );

-- ============================================
-- FORM_INCENTIVES TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE form_incentives ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view form incentives in their organization" ON form_incentives;
DROP POLICY IF EXISTS "Public can view form incentives by form token" ON form_incentives;
DROP POLICY IF EXISTS "Users can manage form incentives in their organization" ON form_incentives;

-- SELECT: Public can view form incentives for active forms (for embed SDK)
CREATE POLICY "Public can view form incentives by form token"
  ON form_incentives FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_incentives.form_id
      AND f.active = true
    )
  );

-- SELECT: Users can view form incentives in their organization
CREATE POLICY "Users can view form incentives in their organization"
  ON form_incentives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_incentives.form_id
      AND f.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT/UPDATE/DELETE: Only Owners, Admins, and Managers can manage form incentives
CREATE POLICY "Users can manage form incentives in their organization"
  ON form_incentives FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_incentives.form_id
      AND has_any_org_role(f.organization_id, ARRAY['Owner', 'Admin', 'Manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_incentives.form_id
      AND has_any_org_role(f.organization_id, ARRAY['Owner', 'Admin', 'Manager'])
    )
  );

-- ============================================
-- PRODUCTS TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Admins, Managers, and Owners can manage products" ON products;
DROP POLICY IF EXISTS "Users can view products in their organizations" ON products;
DROP POLICY IF EXISTS "Admins, Managers, and Owners can manage products in their organizations" ON products;
DROP POLICY IF EXISTS "Users can view products in their organization" ON products;
DROP POLICY IF EXISTS "Users can manage products in their organization" ON products;

-- SELECT: Users can view products in their organization
CREATE POLICY "Users can view products in their organization"
  ON products FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- SELECT: Anonymous users can view products for active forms (embed SDK needs product names/prices)
CREATE POLICY "Public can view products for active forms"
  ON products FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM form_products fp
      JOIN forms f ON f.id = fp.form_id
      WHERE fp.product_id = products.id
      AND f.active = true
    )
  );

-- INSERT/UPDATE/DELETE: Only Owners, Admins, and Managers can manage products
CREATE POLICY "Users can manage products in their organization"
  ON products FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Admin', 'Manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
        AND role IN ('Owner', 'Admin', 'Manager')
    )
  );

-- ============================================
-- PRODUCT_PRICE_HISTORY TABLE RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view product price history in their organization" ON product_price_history;
DROP POLICY IF EXISTS "Users can manage product price history in their organization" ON product_price_history;

-- SELECT: Users can view price history for products in their organization
CREATE POLICY "Users can view product price history in their organization"
  ON product_price_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_price_history.product_id
      AND p.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT/UPDATE/DELETE: Only Owners, Admins, and Managers can manage price history
CREATE POLICY "Users can manage product price history in their organization"
  ON product_price_history FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_price_history.product_id
      AND p.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
          AND role IN ('Owner', 'Admin', 'Manager')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_price_history.product_id
      AND p.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
          AND role IN ('Owner', 'Admin', 'Manager')
      )
    )
  );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_price_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON abandoned_carts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON forms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON form_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON form_incentives TO authenticated;

-- Grant necessary permissions to anonymous users (for embed SDK)
GRANT SELECT ON products TO anon; -- For fetching product names/prices in forms
GRANT SELECT ON forms TO anon; -- For fetching form schemas
GRANT SELECT ON form_products TO anon; -- For fetching form products
GRANT SELECT ON form_incentives TO anon; -- For fetching form incentives
GRANT INSERT ON orders TO anon; -- For submitting orders via Edge Function
GRANT INSERT ON order_items TO anon; -- For submitting order items via Edge Function
GRANT INSERT ON abandoned_carts TO anon; -- For submitting abandoned cart events

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'product_price_history', 'orders', 'order_items', 'abandoned_carts', 'forms', 'form_products', 'form_incentives');

-- List all policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('products', 'product_price_history', 'orders', 'order_items', 'abandoned_carts', 'forms', 'form_products', 'form_incentives')
ORDER BY tablename, policyname;

-- ============================================
-- NOTES
-- ============================================
--
-- Security Model:
-- 1. Authenticated users can only access data from their organizations
-- 2. Anonymous users can:
--    - Read form schemas (for embed SDK)
--    - Create orders/order_items (validated by Edge Function)
--    - Create abandoned carts (validated by embed SDK)
-- 3. Edge Function uses service role key (bypasses RLS) but validates organization
-- 4. Helper functions (is_org_member, has_org_role, etc.) use SECURITY DEFINER to bypass RLS
--
-- Testing:
-- 1. Test as authenticated user: Should only see data from their organizations
-- 2. Test as anonymous user: Should only see active forms and be able to insert orders/carts
-- 3. Test Edge Function: Should validate organization_id before inserting
--
-- Performance:
-- - Policies use EXISTS subqueries for efficiency
-- - Helper functions are indexed and use SECURITY DEFINER for speed
-- - Consider adding indexes on organization_id columns if not already present
--
-- ============================================
