# Database Models Restructure

This document outlines the database models that will be dropped/restructured and the new required structure.

## Current Models to be Dropped/Replaced

### Products (Current)
**File:** `src/types/product.ts`

```typescript
export interface Product {
  id: number;
  name: string;
  created_at?: string | null;
}

export interface ProductPrice {
  id: number;
  product_id: number;
  date: string; // ISO date string
  quantity: number;
  offer: number;
  sales_price: number;
  unit_cost: number;
  created_at?: string | null;
}

export interface ProductWithPrices extends Product {
  prices: ProductPrice[];
}
```

**Current Database Structure:**
- Products table: `id`, `name`, `created_at`
- Product prices stored separately with different structure

---

### Orders (Current)
**File:** `src/types/order.ts`

```typescript
export interface Order {
  id: number;
  customer_name: string;
  phone_number: string | null;
  location: string | null;
  order_date: string; // ISO date string
  order_month: string | null;
  order_year: string | null;
  product_name: string | null;
  mail_quan: number | null;
  agent_quan: number | null;
  quantity: number | null;
  product2: string | null;
  mail_quan2: number | null;
  agent_quan2: number | null;
  quantity2: number | null;
  cost_price: number | null;
  delivery_fee: number | null;
  sales_price: number | null;
  profit: number | null;
  order_status: string | null; // "Delivered" | "Pending" | "Cancelled"
  delivery_date: string | null;
  delivery_month: string | null;
  delivery_year: string | null;
  confirmed_delivery: boolean;
  agent_name: string | null;
  note: string | null;
  subject: string | null;
  assigned_to?: string | null; // UUID of the CSR user assigned to this order
  created_at?: string | null;
  updated_at?: string | null;
}
```

**Current Database Structure:**
- Orders table contains all order data in a flat structure
- Products are stored as text fields (`product_name`, `product2`)
- Quantities and prices are stored directly on the order
- No separate `order_items` table

---

## New Required Structure

### 1. Products Table

```sql
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
```

**TypeScript Interface:**
```typescript
export interface Product {
  id: string; // UUID
  organization_id: string; // UUID
  name: string;
  sku: string | null;
  type: 'NORMAL' | 'INCENTIVE';
  base_price: number;
  cost_price: number;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}
```

**Product Types:**
- **NORMAL**: Regular products with standard pricing
- **INCENTIVE**: Incentives, add-ons, bonuses, or promotional items
  - Can have `base_price = 0` (free items)
  - Can have discounted prices
  - Examples: Free delivery, bonus items, discounted upsells

**Benefits of Treating Incentives as Products:**
- ✅ Appear in analytics (tracked like regular products)
- ✅ Affect inventory if physical items
- ✅ Don't pollute profit math (handled consistently)
- ✅ Clean, unified approach (no special cases)
- ✅ Easy to filter/query by type

---

### 2. Product Price History Table

```sql
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ, -- nullable, NULL means currently active
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**TypeScript Interface:**
```typescript
export interface ProductPriceHistory {
  id: string; // UUID
  product_id: string; // UUID
  price: number;
  cost_price: number;
  starts_at: string; // ISO date string
  ends_at: string | null; // ISO date string, null if currently active
  created_at?: string | null;
}
```

**Purpose:**
- Track historical price changes for products
- When `ends_at` is NULL, it represents the current active price
- Used to snapshot prices at order creation time

---

### 3. Orders Table (Simplified)

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'wordpress',
  status TEXT NOT NULL, -- e.g., 'pending', 'delivered', 'cancelled'
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**TypeScript Interface:**
```typescript
export interface Order {
  id: string; // UUID
  organization_id: string; // UUID
  source: string; // Default: 'wordpress'
  status: string; // 'pending' | 'delivered' | 'cancelled' | etc.
  customer_name: string;
  customer_phone: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
```

**Key Changes:**
- Removed: `product_name`, `quantity`, `cost_price`, `sales_price`, `profit` (moved to `order_items`)
- Removed: `location`, `order_date`, `order_month`, `order_year`, `delivery_date`, etc.
- Removed: `agent_name`, `note`, `subject`, `assigned_to` (may need separate tables or fields)
- Simplified to core order information
- Products and pricing moved to `order_items` table

---

### 4. Order Items Table (NEW - The Magic Table)

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  
  -- SNAPSHOT FIELDS (immutable, captured at order creation)
  unit_price_at_order DECIMAL(10, 2) NOT NULL,
  unit_cost_at_order DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL, -- quantity * unit_price_at_order
  total_cost DECIMAL(10, 2) NOT NULL,  -- quantity * unit_cost_at_order
  profit DECIMAL(10, 2) NOT NULL,       -- total_price - total_cost
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**TypeScript Interface:**
```typescript
export interface OrderItem {
  id: string; // UUID
  order_id: string; // UUID
  product_id: string; // UUID
  quantity: number;
  
  // Snapshot fields (immutable)
  unit_price_at_order: number;
  unit_cost_at_order: number;
  total_price: number;
  total_cost: number;
  profit: number;
  
  created_at?: string | null;
}
```

**Key Features:**
- **Snapshot Fields**: All price/cost/profit data is captured at order creation time
- **Immutable Profit**: Even if product prices change later, the profit on historical orders remains accurate
- **One-to-Many**: One order can have multiple order items (products)
- **Referential Integrity**: Product must exist when order is created (ON DELETE RESTRICT)

---

## Order Creation Flow

### At Order Creation:

1. **Fetch Latest Active Price**
   ```sql
   SELECT price, cost_price 
   FROM product_price_history 
   WHERE product_id = $1 
   AND ends_at IS NULL  -- Currently active price
   ORDER BY starts_at DESC 
   LIMIT 1;
   ```

2. **Copy Values into order_items**
   - Store `unit_price_at_order` = current price
   - Store `unit_cost_at_order` = current cost_price
   - Calculate `total_price` = quantity × unit_price_at_order
   - Calculate `total_cost` = quantity × unit_cost_at_order
   - Calculate `profit` = total_price - total_cost
   - **Note**: For INCENTIVE products with `base_price = 0`, profit will be negative (cost only), which is correct

3. **Profit Becomes Immutable**
   - Even if prices triple tomorrow, yesterday's profit stays honest
   - Historical financial reports remain accurate
   - Incentives are included in calculations but don't pollute profit math (they're just products with zero/discounted prices)

---

## Migration Notes

### Data to Migrate:
- Current `orders` table has product data embedded
- Need to:
  1. Extract products from `product_name` fields
  2. Create `products` entries
  3. Create `product_price_history` entries
  4. Split orders into `orders` + `order_items`
  5. Calculate snapshot values for existing orders

### Fields to Consider:
- `location`, `delivery_date`, `agent_name`, `note`, `subject`, `assigned_to` - may need separate tables or additional fields
- `delivery_fee` - may need to be on order or order_items level

---

## Benefits of New Structure

1. **Normalized Data**: Products stored once, referenced many times
2. **Price History**: Track price changes over time
3. **Accurate Profit Tracking**: Immutable snapshots ensure historical accuracy
4. **Flexibility**: Multiple products per order (no more `product2` hack)
5. **Scalability**: Easy to add more order metadata without bloating orders table
6. **Data Integrity**: Foreign keys ensure referential integrity
7. **Clean Incentive Handling**: Treat incentives as products (zero/discounted price) - appears in analytics, affects inventory, doesn't pollute profit math

## Incentives & Add-On Products

### Clean Approach

Incentives are treated as products with a special `type = 'INCENTIVE'` field. This provides a unified, clean approach to handling:

- **Free delivery** (product with `base_price = 0`)
- **Bonus items** (product with `base_price = 0` or discounted)
- **Discounted upsells** (product with `base_price < cost_price` or `base_price = 0`)

### How It Works

1. **Create Incentive Products**
   ```sql
   INSERT INTO products (organization_id, name, type, base_price, cost_price, active)
   VALUES 
     ('org-uuid', 'Free Delivery', 'INCENTIVE', 0.00, 0.00, TRUE),
     ('org-uuid', 'Bonus Gift', 'INCENTIVE', 0.00, 5.00, TRUE),
     ('org-uuid', '50% Off Upsell', 'INCENTIVE', 10.00, 20.00, TRUE);
   ```

2. **Add to Orders**
   - Incentives are added to orders just like regular products
   - They appear in `order_items` with their snapshot values
   - Profit calculation: `profit = total_price - total_cost`
   - For free incentives: `profit = 0 - cost` (negative, representing the cost of the incentive)

3. **Analytics & Reporting**
   - Filter by `product.type = 'INCENTIVE'` to see incentive usage
   - Track which incentives are most popular
   - Calculate total incentive costs
   - All products (normal + incentive) appear in unified reports

4. **Inventory Impact**
   - If incentive is a physical item, it affects inventory
   - Tracked the same way as regular products
   - Can set `cost_price` to track the cost of providing the incentive

### Profit Math Example

**Order with Regular Product + Free Incentive:**
- Regular Product: `quantity=1, price=100, cost=50` → `profit=50`
- Free Bonus: `quantity=1, price=0, cost=10` → `profit=-10`
- **Total Order Profit**: `50 + (-10) = 40` ✅

The incentive cost is properly accounted for without polluting the profit calculation logic.

**📊 For comprehensive profit calculation strategy, see:** `INCENTIVES_PROFIT_STRATEGY.md`

---

## Custom Forms System (Hybrid Embed Plugin)

### Overview

A hybrid embed plugin system that allows users to create custom forms from the SaaS dashboard, attach products, and embed them in WordPress sites. The plugin is minimal and clean - it doesn't store orders, calculate prices, or talk to the database directly. This approach ensures plugins survive WordPress chaos.

### 5. Custom Forms System

#### What Users Can Do

From your SaaS dashboard:

1. **Create a Form**
   - Design custom form fields
   - Configure validation rules
   - Set form behavior

2. **Attach Products**
   - Link products to the form
   - Set quantities allowed
   - Configure optional incentives
   - Set pricing mode (fixed / selectable)

3. **Generate a Form Token**
   - Example: `form_live_98Fh3ksd`
   - Public token scoped to organization + form
   - Used for embedding in WordPress

#### Database Schema (Forms Table)

```sql
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  form_token TEXT NOT NULL UNIQUE, -- e.g., 'form_live_98Fh3ksd'
  schema JSONB NOT NULL, -- Form field definitions, validation rules
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forms_organization_id ON forms(organization_id);
CREATE INDEX idx_forms_token ON forms(form_token);
```

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

```sql
CREATE TABLE form_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  trigger_condition JSONB, -- e.g., {"min_order_value": 100, "product_ids": [...]}
  auto_apply BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(form_id, product_id)
);
```

**TypeScript Interfaces:**
```typescript
export interface Form {
  id: string; // UUID
  organization_id: string; // UUID
  name: string;
  form_token: string; // e.g., 'form_live_98Fh3ksd'
  schema: FormSchema; // JSONB
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FormSchema {
  fields: FormField[];
  validation?: ValidationRules;
  submitButton?: {
    text: string;
    loadingText?: string;
  };
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'textarea';
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  validation?: FieldValidation;
}

export interface FormProduct {
  id: string;
  form_id: string;
  product_id: string;
  min_quantity: number;
  max_quantity: number | null;
  required: boolean;
  pricing_mode: 'fixed' | 'selectable';
  display_order: number;
}

export interface FormIncentive {
  id: string;
  form_id: string;
  product_id: string;
  trigger_condition: {
    min_order_value?: number;
    product_ids?: string[];
    [key: string]: any;
  };
  auto_apply: boolean;
  display_order: number;
}
```

---

### 6. WordPress Plugin Responsibilities

#### Plugin DOES:

1. **Store API Key + Org ID**
   - Settings page in WordPress admin
   - Secure storage (wp_options table)
   - Configuration UI

2. **Register Shortcode / Block**
   - Shortcode: `[crm_form form="form_live_98Fh3ksd"]`
   - Gutenberg block for visual editor
   - Simple token-based embedding

3. **Load JS SDK**
   - Enqueue `embed.js` from SaaS domain
   - Pass form token as data attribute
   - Handle loading states

4. **Mount Form Container**
   - Render `<div id="crm-form" data-form-token="..."></div>`
   - Let SDK handle everything else

5. **Handle Success / Error UI**
   - Display success messages
   - Show error states
   - Basic UI feedback

#### Plugin DOES NOT:

- ❌ Store orders
- ❌ Calculate prices
- ❌ Validate products
- ❌ Talk to DB directly
- ❌ Handle business logic

**This minimal approach ensures plugins survive WordPress chaos** 🌪️

---

### 7. WordPress Form Rendering Flow

#### HTML Structure

```html
<div id="crm-form" data-form-token="form_live_98Fh3ksd"></div>
<script src="https://mail9ja.vercel.app/embed.js"></script>
```

#### embed.js Responsibilities

1. **Fetch Form Schema**
   ```javascript
   // GET /api/forms/{form_token}
   // Returns: { schema, products, incentives }
   ```

2. **Render Fields**
   - Dynamically render form inputs based on schema
   - Handle field types (text, email, phone, etc.)
   - Apply validation rules

3. **Handle Quantity & Incentive Logic**
   - Product quantity selectors
   - Auto-apply incentives based on conditions
   - Calculate totals in real-time

4. **Submit to Supabase API**
   ```javascript
   // POST /api/create-order-from-form
   // Body: { form_token, field_values, products: [{id, quantity}], ... }
   ```

5. **Show Success State**
   - Display confirmation message
   - Clear form
   - Optional redirect

6. **Emit Abandoned-Cart Events**
   - Track form interactions
   - Fire abandoned cart event after 30s of inactivity
   - Send to Supabase for follow-up system

---

### 8. Abandoned Cart Tracking

#### Logic

1. **User starts filling form**
   - Track field interactions
   - Start 30-second timer

2. **No submit after 30s**
   - Fire abandoned cart event

3. **Event Payload**
   ```json
   {
     "event": "abandoned_cart",
     "form_id": "form_live_98Fh3ksd",
     "organization_id": "org-uuid",
     "page_url": "https://example.com/product-page",
     "filled_fields": ["name", "phone"],
     "field_values": {
       "name": "John Doe",
       "phone": "+1234567890"
     },
     "selected_products": [
       {"product_id": "...", "quantity": 2}
     ],
     "abandoned_at": "2024-01-15T10:30:00Z"
   }
   ```

#### Database Schema

```sql
CREATE TABLE abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
  page_url TEXT,
  filled_fields JSONB, -- Array of field names that were filled
  field_values JSONB, -- Actual field values
  selected_products JSONB, -- [{product_id, quantity}]
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

#### This Feeds:

- **Follow-ups**: Trigger automated follow-up sequences
- **Conversion metrics**: Track form completion rates
- **CSR assignments**: Auto-assign to customer relations team
- **Analytics**: Understand drop-off points

---

### 9. Security Model (Non-Negotiable 🔐)

#### Public Form Token (Scoped to Org + Form)

- Form tokens are public (can be embedded anywhere)
- Scoped to specific organization + form
- No secrets exposed to WordPress

#### RLS on All Tables

```sql
-- Example RLS Policy for orders
CREATE POLICY "Users can view orders in their organization"
  ON orders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Example RLS Policy for forms
CREATE POLICY "Forms are accessible by token"
  ON forms FOR SELECT
  USING (true); -- Public read access for form schema

CREATE POLICY "Users can manage forms in their organization"
  ON forms FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

#### Rate Limiting

- **By IP**: Prevent abuse from single source
- **By Form Token**: Limit submissions per form
- **By Organization**: Overall rate limits

#### Validation

- ✅ Product belongs to org (verify `product.organization_id`)
- ✅ Form belongs to org (verify `form.organization_id`)
- ✅ All products in order belong to same org
- ✅ Form is active (`form.active = TRUE`)
- ✅ Products are active (`product.active = TRUE`)

#### WordPress Never Sees Secrets

- No API keys in frontend code
- No database credentials
- No Supabase service role keys
- Only public form tokens

---

### 10. Step-by-Step Execution Plan

#### Phase 1: Backend Foundation

1. **Design DB Schema**
   - ✅ `products` table (with `type` field)
   - ✅ `product_price_history` table
   - ✅ `orders` table (simplified)
   - ✅ `order_items` table (with snapshot fields)
   - ✅ `forms` table
   - ✅ `form_products` table
   - ✅ `form_incentives` table
   - ✅ `abandoned_carts` table

2. **Enable RLS**
   - Row-level security on all tables
   - Organization-scoped policies
   - Public read access for form schemas

3. **Create Edge Function** ✅ **COMPLETED**
   - `POST /create-order-from-form` - **See:** `supabase/functions/create-order-from-form/`
   - ✅ Validate form token
   - ✅ Validate products belong to org
   - ✅ Snapshot prices into order_items
   - ✅ Calculate profit correctly
   - ✅ Enforce RLS
   - ✅ Transaction safety (rollback on failure)
   - ✅ Comprehensive error handling

#### Phase 2: Forms Engine

1. **Create Forms Table** (see schema above)

2. **Create Form Builder UI**
   - Drag-and-drop form builder
   - Field configuration
   - Validation rules
   - Preview mode

3. **Attach Products + Incentives**
   - Product selector
   - Quantity limits
   - Pricing mode selection
   - Incentive configuration

4. **Generate Form Tokens**
   - Auto-generate unique tokens
   - Format: `form_live_{random}`
   - Display in dashboard

#### Phase 3: Embed SDK ✅ **COMPLETED**

1. **Build embed.js** ✅ **COMPLETED**
   - ✅ Lightweight JavaScript library (no dependencies)
   - ✅ Cross-browser compatible
   - ✅ **See:** `scripts/embed.js`

2. **Schema-Driven Rendering** ✅ **COMPLETED**
   - ✅ Parse form schema from API
   - ✅ Dynamically render fields (text, email, phone, number, textarea, select)
   - ✅ Apply validation rules

3. **Validation + Submission** ✅ **COMPLETED**
   - ✅ Client-side validation
   - ✅ Submit to Edge Function (`/functions/v1/create-order-from-form`)
   - ✅ Handle errors gracefully

4. **Abandoned Cart Timer** ✅ **COMPLETED**
   - ✅ 30-second inactivity timer
   - ✅ Track field interactions
   - ✅ Fire event to Supabase `abandoned_carts` table

**Files Created:**
- `scripts/embed.js` - Main SDK file
- `scripts/embed.css` - Default styles
- `scripts/embed-sdk-README.md` - Complete documentation

#### Phase 4: WordPress Plugin ✅ **COMPLETED**

1. **Plugin Boilerplate** ✅ **COMPLETED**
   - ✅ Standard WordPress plugin structure
   - ✅ Activation/deactivation hooks
   - ✅ Settings page
   - ✅ **See:** `scripts/wordpress-plugin/crm-form-embed.php`

2. **Shortcode + Block** ✅ **COMPLETED**
   - ✅ `[crm_form form="TOKEN"]` shortcode
   - ✅ Gutenberg block for visual editor
   - ✅ Token input field
   - ✅ **See:** `scripts/wordpress-plugin/block.js`

3. **Settings Page** ✅ **COMPLETED**
   - ✅ Supabase URL configuration
   - ✅ Supabase Anon Key configuration
   - ✅ Embed SDK URLs configuration
   - ✅ Settings validation and sanitization

4. **Load Embed SDK** ✅ **COMPLETED**
   - ✅ Enqueue embed.js and embed.css
   - ✅ Pass configuration via global variables
   - ✅ Handle container mounting
   - ✅ Multiple forms support

**Files Created:**
- `scripts/wordpress-plugin/crm-form-embed.php` - Main plugin file
- `scripts/wordpress-plugin/block.js` - Gutenberg block
- `scripts/wordpress-plugin/uninstall.php` - Cleanup script
- `scripts/wordpress-plugin/README.md` - Complete documentation

#### Phase 5: Analytics & Follow-Ups

1. **Hook Abandoned Carts to Follow-Up System**
   - Auto-create follow-up tasks
   - Assign to CSR team
   - Set SLA deadlines

2. **CSR Auto-Assignment**
   - Round-robin assignment
   - Load balancing
   - Skill-based routing (future)

3. **SLA Tracking**
   - Track response times
   - Monitor conversion rates
   - Generate reports

---

### 11. Cursor Prompts (Copy & Paste)

#### Backend Order Creation
```
Design a Supabase Edge Function that accepts a public form token,
validates the organization and products, snapshots product prices
into order_items, calculates profit correctly even if prices change later,
and enforces row-level security.
```

#### Embed SDK
```
Create a lightweight JavaScript embed SDK that fetches a form schema
from an API, dynamically renders inputs and product selectors,
handles abandoned cart detection after 30 seconds,
and submits orders securely to Supabase.
```

#### WordPress Plugin
```
Generate a minimal WordPress plugin that registers a shortcode
[crm_form form="TOKEN"], loads an external embed SDK,
and provides an admin settings page for API configuration.
```

#### Incentives Logic
```
Design a data model and order calculation strategy that supports
zero-priced incentive products without breaking profit analytics.
```

#### RLS Policies ✅ **COMPLETED**
```
Write Supabase Row Level Security policies that enforce
organization-scoped access for orders, order_items,
abandoned_carts, and forms.
```

**See:** 
- `scripts/rls-policies-orders-forms.sql` - Complete SQL file with all policies
- `scripts/RLS_POLICIES_GUIDE.md` - Comprehensive guide and testing instructions

---

### 12. Final Thought

This setup gives you:

- ✅ **Accurate profit forever** - Immutable snapshots ensure historical accuracy
- ✅ **Zero WordPress tech debt** - Minimal plugin, all logic in SaaS
- ✅ **Infinite custom forms** - Schema-driven, flexible form builder
- ✅ **Clean multi-tenancy** - Organization-scoped everything
- ✅ **Serious enterprise credibility** - Professional architecture

**You're not building "a plugin". You're building infrastructure** 🏗️✨

---

## Status

⚠️ **DO NOT IMPLEMENT YET** - This is documentation only.

**Next Steps (when ready):**
- DB schema SQL
- Exact Edge Function code
- embed.js MVP
- WP plugin boilerplate
