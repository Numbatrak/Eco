# Implementation Guide - Complete Setup

Step-by-step guide to make all the database restructure changes functional.

## Prerequisites

- ✅ Supabase project set up
- ✅ Supabase CLI installed (for Edge Functions)
- ✅ WordPress site (for plugin)
- ✅ Access to Supabase dashboard
- ✅ Database backup (IMPORTANT!)

## Phase 1: Database Setup

### Step 1.1: Backup Current Database (Optional for Non-Production)

**For Production:** Always backup before making changes!

**For Non-Production/Development:** You can skip backup if you're okay losing data.

```sql
-- In Supabase SQL Editor, export your data:
-- 1. Go to Table Editor
-- 2. Export each table as CSV/JSON
-- 3. Or use pg_dump if you have CLI access
```

**Quick Option for Non-Production:**
If you want a clean slate, you can use the fresh start script:
- Run `scripts/fresh-start.sql` - This drops old tables and creates new ones in one go
- Or run `scripts/drop-old-tables.sql` first, then `scripts/create-new-schema.sql`

### Step 1.2: Create New Tables

Run these SQL scripts in order:

1. **Products Table**
   ```sql
   -- Create products table
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
   ```

2. **Product Price History Table**
   ```sql
   CREATE TABLE product_price_history (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     price DECIMAL(10, 2) NOT NULL,
     cost_price DECIMAL(10, 2) NOT NULL,
     starts_at TIMESTAMPTZ NOT NULL,
     ends_at TIMESTAMPTZ, -- NULL = currently active
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   CREATE INDEX idx_product_price_history_product_id ON product_price_history(product_id);
   CREATE INDEX idx_product_price_history_active ON product_price_history(product_id, ends_at) WHERE ends_at IS NULL;
   ```

3. **New Orders Table** (if replacing old one)
   ```sql
   -- Backup old orders table first!
   CREATE TABLE orders_new (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
     source TEXT NOT NULL DEFAULT 'wordpress',
     status TEXT NOT NULL,
     customer_name TEXT NOT NULL,
     customer_phone TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   CREATE INDEX idx_orders_organization_id ON orders_new(organization_id);
   CREATE INDEX idx_orders_status ON orders_new(status);
   CREATE INDEX idx_orders_created_at ON orders_new(created_at);
   ```

4. **Order Items Table**
   ```sql
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
   
   -- Add constraint to ensure profit calculation is correct
   ALTER TABLE order_items 
   ADD CONSTRAINT check_profit_calculation 
   CHECK (profit = (total_price - total_cost));
   
   ALTER TABLE order_items 
   ADD CONSTRAINT check_total_price_calculation 
   CHECK (total_price = (quantity * unit_price_at_order));
   
   ALTER TABLE order_items 
   ADD CONSTRAINT check_total_cost_calculation 
   CHECK (total_cost = (quantity * unit_cost_at_order));
   ```

5. **Forms Table**
   ```sql
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
   ```

6. **Form Products Table**
   ```sql
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
   ```

7. **Form Incentives Table**
   ```sql
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
   ```

8. **Abandoned Carts Table** (if not exists)
   ```sql
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
   ```

### Step 1.3: Apply RLS Policies

Run the RLS policies script:

```bash
# In Supabase SQL Editor, run:
# scripts/rls-policies-orders-forms.sql
```

Or copy the contents of `scripts/rls-policies-orders-forms.sql` into Supabase SQL Editor and execute.

**Verify RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('orders', 'order_items', 'abandoned_carts', 'forms', 'form_products', 'form_incentives');
```

### Step 1.4: Migrate Existing Data (If Applicable)

If you have existing orders/products, you'll need to migrate them:

1. **Migrate Products**
   ```sql
   -- Example: Migrate from old products table
   INSERT INTO products (organization_id, name, base_price, cost_price, active)
   SELECT 
     organization_id,
     name,
     base_price, -- or calculate from price history
     cost_price, -- or calculate from price history
     active
   FROM old_products_table;
   ```

2. **Create Initial Price History**
   ```sql
   -- Create price history entries for existing products
   INSERT INTO product_price_history (product_id, price, cost_price, starts_at)
   SELECT 
     id,
     base_price,
     cost_price,
     created_at
   FROM products;
   ```

3. **Migrate Orders** (if you have existing orders)
   - This is complex and depends on your old schema
   - You may need to create a custom migration script
   - See `DATABASE_MODELS_RESTRUCTURE.md` for migration notes

## Phase 2: Deploy Edge Function

### Step 2.1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Or using npm
npm install -g supabase
```

### Step 2.2: Link Your Project

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref
```

Get your project ref from: Supabase Dashboard → Settings → General → Reference ID

### Step 2.3: Deploy Edge Function

```bash
# Navigate to your project root
cd /Users/macbookpro/Desktop/mail9ja

# Deploy the function
supabase functions deploy create-order-from-form
```

### Step 2.4: Verify Deployment

1. Go to Supabase Dashboard → Edge Functions
2. Verify `create-order-from-form` is listed
3. Test the function (see Testing section)

## Phase 3: Host Embed SDK Files

### Step 3.1: Choose Hosting Option

Options:
- **CDN** (recommended): Cloudflare, AWS CloudFront, etc.
- **Your own server**: Host on your domain
- **Supabase Storage**: Use Supabase Storage buckets

### Step 3.2: Upload Files

Upload these files to your hosting:

1. `scripts/embed.js` → `https://app.numbatrak.io/embed.js`
2. `scripts/embed.css` → `https://app.numbatrak.io/embed.css`

### Step 3.3: Configure CORS

Ensure your hosting allows CORS from WordPress sites:

```javascript
// Example CORS headers for embed.js
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Step 3.4: Test File Access

```bash
# Test that files are accessible
curl https://app.numbatrak.io/embed.js
curl https://app.numbatrak.io/embed.css
```

## Phase 4: Install WordPress Plugin

### Step 4.1: Prepare Plugin Files

1. Create plugin directory:
   ```bash
   mkdir -p wp-content/plugins/crm-form-embed
   ```

2. Copy plugin files:
   ```bash
   cp scripts/wordpress-plugin/crm-form-embed.php wp-content/plugins/crm-form-embed/
   cp scripts/wordpress-plugin/block.js wp-content/plugins/crm-form-embed/
   cp scripts/wordpress-plugin/uninstall.php wp-content/plugins/crm-form-embed/
   ```

### Step 4.2: Activate Plugin

1. Go to WordPress Admin → Plugins
2. Find "CRM Form Embed"
3. Click "Activate"

### Step 4.3: Configure Settings

1. Go to **Settings → CRM Form Embed**
2. Enter:
   - **Supabase URL**: `https://tgyetavhkukcclnwrroz.supabase.co`
   - **Supabase Anon Key**: From Supabase Dashboard → Settings → API
   - **Embed JS URL**: `https://app.numbatrak.io/embed.js`
   - **Embed CSS URL**: `https://app.numbatrak.io/embed.css`
3. Click "Save Settings"

## Phase 5: Create Test Data

### Step 5.1: Create a Product

```sql
INSERT INTO products (organization_id, name, sku, type, base_price, cost_price, active)
VALUES (
  'your-org-id',
  'Test Product',
  'TEST-001',
  'NORMAL',
  100.00,
  50.00,
  TRUE
)
RETURNING id;
```

### Step 5.2: Create Price History

```sql
INSERT INTO product_price_history (product_id, price, cost_price, starts_at)
VALUES (
  'product-id-from-above',
  100.00,
  50.00,
  NOW()
);
```

### Step 5.3: Create a Form

```sql
INSERT INTO forms (organization_id, name, form_token, schema, active)
VALUES (
  'your-org-id',
  'Test Form',
  'form_live_test123',
  '{
    "fields": [
      {
        "id": "name",
        "type": "text",
        "label": "Full Name",
        "name": "customer_name",
        "required": true,
        "placeholder": "Enter your name"
      },
      {
        "id": "phone",
        "type": "phone",
        "label": "Phone Number",
        "name": "phone",
        "required": true,
        "placeholder": "+1234567890"
      }
    ],
    "submitButton": {
      "text": "Place Order",
      "loadingText": "Processing..."
    }
  }'::jsonb,
  TRUE
)
RETURNING id;
```

### Step 5.4: Attach Product to Form

```sql
INSERT INTO form_products (form_id, product_id, min_quantity, max_quantity, required, pricing_mode)
VALUES (
  'form-id-from-above',
  'product-id-from-above',
  1,
  10,
  TRUE,
  'fixed'
);
```

## Phase 6: Testing

### Step 6.1: Test Edge Function

```bash
# Test with curl
curl -X POST \
  https://tgyetavhkukcclnwrroz.supabase.co/functions/v1/create-order-from-form \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "form_token": "form_live_test123",
    "customer_name": "Test Customer",
    "customer_phone": "+1234567890",
    "items": [
      {
        "product_id": "your-product-id",
        "quantity": 2
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "order": { ... },
  "order_items": [ ... ],
  "totals": { ... }
}
```

### Step 6.2: Test Embed SDK

1. Create a test HTML file:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <link rel="stylesheet" href="https://app.numbatrak.io/embed.css">
   </head>
   <body>
     <div id="crm-form" data-form-token="form_live_test123"></div>
     <script>
       window.CRM_SUPABASE_URL = 'https://tgyetavhkukcclnwrroz.supabase.co';
       window.CRM_SUPABASE_ANON_KEY = 'your-anon-key';
       window.CRM_DEBUG = true;
     </script>
     <script src="https://app.numbatrak.io/embed.js"></script>
   </body>
   </html>
   ```

2. Open in browser and test:
   - Form should load
   - Products should display
   - Submit should work
   - Check browser console for errors

### Step 6.3: Test WordPress Plugin

1. Create a test page in WordPress
2. Add shortcode: `[crm_form form="form_live_test123"]`
3. Publish and view page
4. Test form submission
5. Verify order created in Supabase

### Step 6.4: Test Abandoned Cart

1. Fill form but don't submit
2. Wait 30 seconds
3. Check `abandoned_carts` table in Supabase
4. Verify event was created

## Phase 7: Production Checklist

- [ ] Database backup completed
- [ ] All tables created
- [ ] RLS policies applied
- [ ] Edge Function deployed
- [ ] Embed SDK files hosted and accessible
- [ ] WordPress plugin installed and configured
- [ ] Test data created
- [ ] Edge Function tested
- [ ] Embed SDK tested
- [ ] WordPress plugin tested
- [ ] Abandoned cart tracking tested
- [ ] Old data migrated (if applicable)
- [ ] Production data verified
- [ ] Monitoring set up

## Troubleshooting

### Edge Function Not Working

1. Check function logs in Supabase Dashboard
2. Verify service role key is set
3. Check function URL is correct
4. Verify form token exists and is active

### Embed SDK Not Loading

1. Check browser console for errors
2. Verify CORS headers are set
3. Check file URLs are correct
4. Verify Supabase URL and anon key

### WordPress Plugin Issues

1. Check plugin is activated
2. Verify settings are saved
3. Check shortcode syntax
4. View page source to verify scripts are loading

### RLS Policy Errors

1. Check helper functions exist
2. Verify RLS is enabled on tables
3. Check user has organization membership
4. Review policy logs in Supabase

## Next Steps

After everything is working:

1. **Create Form Builder UI** - Build dashboard UI for creating forms
2. **Add Analytics** - Build reports using the new schema
3. **Migrate Old Data** - If you have existing orders/products
4. **Set Up Monitoring** - Monitor Edge Function performance
5. **Documentation** - Document for your team

## Support Files Reference

- `DATABASE_MODELS_RESTRUCTURE.md` - Complete schema documentation
- `INCENTIVES_PROFIT_STRATEGY.md` - Profit calculation guide
- `scripts/rls-policies-orders-forms.sql` - RLS policies
- `scripts/RLS_POLICIES_GUIDE.md` - RLS guide
- `supabase/functions/create-order-from-form/README.md` - Edge Function docs
- `scripts/embed-sdk-README.md` - Embed SDK docs
- `scripts/wordpress-plugin/README.md` - WordPress plugin docs

## Need Help?

If you encounter issues:

1. Check the relevant documentation file
2. Review error messages carefully
3. Test each component individually
4. Verify all prerequisites are met
5. Check Supabase logs and browser console

Good luck! 🚀
