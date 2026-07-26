# Form Responses Architecture

## Overview

This document describes the unified form responses system that replaces the separate `orders` and `abandoned_carts` tables. All form submissions are now stored as `form_responses`, with constants extracted for easy querying and profit accumulation.

## Key Principles

1. **Single Source of Truth**: All form data is stored in `field_values` JSONB column
2. **Constants Extraction**: Only a few fields are extracted as constants:
   - `phone_number` - for easy querying
   - `package_name` - for easy filtering/grouping
   - `customer_name` - for display
   - `profit` - calculated from items, only set when status = 'completed'
3. **Profit Accumulation**: Profit only counts toward dashboard when `status = 'completed'`
4. **Response Types**: Each response can be either:
   - `'order'` - A completed form submission
   - `'abandoned_cart'` - An incomplete form submission

## Database Schema

### `form_responses` Table

```sql
CREATE TABLE form_responses (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  form_id UUID,
  
  -- Response type: 'order' or 'abandoned_cart'
  response_type TEXT NOT NULL DEFAULT 'order',
  
  -- Status: 'abandoned', 'pending', 'completed', 'cancelled'
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Source of submission
  source TEXT NOT NULL DEFAULT 'wordpress',
  page_url TEXT,
  
  -- ALL FORM DATA (source of truth)
  field_values JSONB NOT NULL DEFAULT '{}',
  selected_products JSONB DEFAULT '[]',
  
  -- EXTRACTED CONSTANTS (for convenience)
  phone_number TEXT,      -- Extracted from field_values
  package_name TEXT,       -- Extracted from field_values
  customer_name TEXT,      -- Extracted from field_values
  profit DECIMAL(10, 2),   -- Only set when status = 'completed'
  
  -- Timestamps
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, -- Set when status = 'completed'
  
  -- Conversion tracking
  converted_from_abandoned BOOLEAN DEFAULT FALSE,
  converted_response_id UUID
);
```

### `form_response_items` Table

Stores individual product items with price snapshots:

```sql
CREATE TABLE form_response_items (
  id UUID PRIMARY KEY,
  form_response_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  
  -- Price snapshots at submission time
  unit_price_at_submission DECIMAL(10, 2),
  unit_cost_at_submission DECIMAL(10, 2),
  
  -- Calculated totals
  total_price DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  profit DECIMAL(10, 2)
);
```

## How It Works

### 1. Form Submission Flow

```
User submits form
    ↓
Edge Function receives submission
    ↓
Validates form token & products
    ↓
Creates form_response record:
  - Stores ALL data in field_values JSONB
  - Sets response_type = 'order'
  - Sets status = 'pending'
    ↓
Creates form_response_items with price snapshots
    ↓
Database trigger extracts constants:
  - phone_number from field_values
  - package_name from field_values
  - customer_name from field_values
  - profit = 0 (not completed yet)
```

### 2. Profit Accumulation

Profit is calculated and accumulated in two ways:

#### Automatic (via Database Triggers)

1. **When items are created/updated**: The `update_form_response_profit()` trigger recalculates profit from `form_response_items`
2. **When status changes to 'completed'**: The `extract_form_response_constants()` trigger:
   - Calculates total profit from items
   - Sets `completed_at` timestamp
   - Updates `profit` field

#### Manual (via Application Code)

When updating a form response status to 'completed':

```typescript
// Update status to completed
await supabase
  .from('form_responses')
  .update({ 
    status: 'completed',
    // Profit will be auto-calculated by trigger
  })
  .eq('id', responseId);
```

### 3. Dashboard Profit Calculation

The dashboard only counts profit from **completed** form responses:

```typescript
// Only query completed responses
const { data } = await supabase
  .from('form_responses')
  .select('profit')
  .eq('organization_id', orgId)
  .eq('status', 'completed')  // Only completed orders
  .gte('completed_at', startDate)
  .lt('completed_at', endDate);

// Sum all profits
const totalProfit = data.reduce((sum, r) => sum + (r.profit || 0), 0);
```

## Constants Extraction

Constants are automatically extracted from `field_values` by database triggers. The extraction logic handles multiple field name variations:

### Phone Number Extraction

Tries these field names in order:
1. `customer_phone`
2. `phone_number`
3. `whatsapp_number`
4. `phone`

### Package Name Extraction

Tries these field names in order:
1. `package_name`
2. `selected_package`
3. `package`
4. `package_type`

### Customer Name Extraction

Tries these field names in order:
1. `customer_name`
2. `name`
3. `first_name + ' ' + last_name` (concatenated)

## Example Form Response

### Input (Form Submission)

```json
{
  "form_token": "form_live_abc123",
  "customer_name": "John Doe",
  "customer_phone": "+2348012345678",
  "field_values": {
    "customer_name": "John Doe",
    "customer_phone": "+2348012345678",
    "location": "Lagos, Nigeria",
    "package_type": "premium",
    "delivery_address": "123 Main St",
    "additional_notes": "Please deliver before 5pm"
  },
  "items": [
    {
      "product_id": "550e8400-...",
      "quantity": 2
    }
  ]
}
```

### Stored in Database

**form_responses record:**
```json
{
  "id": "a1b2c3d4-...",
  "organization_id": "org-123",
  "form_id": "form-456",
  "response_type": "order",
  "status": "pending",
  "source": "wordpress",
  "field_values": {
    "customer_name": "John Doe",
    "customer_phone": "+2348012345678",
    "location": "Lagos, Nigeria",
    "package_type": "premium",
    "delivery_address": "123 Main St",
    "additional_notes": "Please deliver before 5pm"
  },
  "selected_products": [
    {
      "product_id": "550e8400-...",
      "quantity": 2
    }
  ],
  "phone_number": "+2348012345678",  // Extracted constant
  "package_name": "premium",          // Extracted constant
  "customer_name": "John Doe",        // Extracted constant
  "profit": 0,                        // Not completed yet
  "created_at": "2026-01-27T10:00:00Z"
}
```

**form_response_items record:**
```json
{
  "id": "b2c3d4e5-...",
  "form_response_id": "a1b2c3d4-...",
  "product_id": "550e8400-...",
  "quantity": 2,
  "unit_price_at_submission": 1500.00,
  "unit_cost_at_submission": 1000.00,
  "total_price": 3000.00,
  "total_cost": 2000.00,
  "profit": 1000.00
}
```

### After Completion

When status changes to `'completed'`:

```json
{
  "status": "completed",
  "profit": 1000.00,  // Now set from items
  "completed_at": "2026-01-27T15:00:00Z"
}
```

Now this profit will be included in dashboard calculations.

## Migration from Old System

### Old Tables (to be dropped)
- `orders` - replaced by `form_responses`
- `order_items` - replaced by `form_response_items`
- `abandoned_carts` - replaced by `form_responses` (with `response_type = 'abandoned_cart'`)

### Migration Steps

1. Run `scripts/create-form-responses-schema.sql` to create new tables
2. Migrate existing data (if needed):
   - Convert `orders` → `form_responses` with `response_type = 'order'`
   - Convert `order_items` → `form_response_items`
   - Convert `abandoned_carts` → `form_responses` with `response_type = 'abandoned_cart'`
3. Update Edge Function (already done)
4. Update dashboard queries (already done)
5. Update frontend components

## Benefits

1. **Single Table**: One table for all form responses (orders + abandoned carts)
2. **Flexible Schema**: `field_values` JSONB allows any form structure
3. **Automatic Extraction**: Constants extracted automatically via triggers
4. **Profit Tracking**: Only completed orders count toward profit
5. **Easy Querying**: Constants extracted for fast queries without JSONB parsing
6. **Historical Accuracy**: Price snapshots ensure accurate profit calculations

## Query Examples

### Get all completed orders with profit

```sql
SELECT 
  id,
  customer_name,
  phone_number,
  package_name,
  profit,
  completed_at
FROM form_responses
WHERE organization_id = 'org-123'
  AND status = 'completed'
  AND response_type = 'order'
ORDER BY completed_at DESC;
```

### Get total profit for organization

```sql
SELECT SUM(profit) as total_profit
FROM form_responses
WHERE organization_id = 'org-123'
  AND status = 'completed';
```

### Get abandoned carts

```sql
SELECT *
FROM form_responses
WHERE organization_id = 'org-123'
  AND response_type = 'abandoned_cart'
  AND status = 'abandoned'
ORDER BY created_at DESC;
```

### Access custom field values

```sql
SELECT 
  id,
  customer_name,
  field_values->>'location' as location,
  field_values->>'delivery_address' as address,
  field_values->>'additional_notes' as notes
FROM form_responses
WHERE organization_id = 'org-123';
```
