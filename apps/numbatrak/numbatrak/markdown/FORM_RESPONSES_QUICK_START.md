# Form Responses System - Quick Start Guide

## What Changed?

We've unified the `orders` and `abandoned_carts` tables into a single `form_responses` table. This makes the system more flexible and easier to manage.

## Key Features

✅ **Single Table**: All form submissions (orders + abandoned carts) in one place  
✅ **Constants Extraction**: Phone, package name, and profit automatically extracted  
✅ **Profit Accumulation**: Only completed orders count toward dashboard profit  
✅ **Flexible Schema**: All form data stored in JSONB for maximum flexibility  

## How It Works

### 1. Form Submission → Form Response

When a user submits a form:
- All form data is stored in `field_values` JSONB column
- Constants are automatically extracted:
  - `phone_number` - from `customer_phone`, `phone_number`, etc.
  - `package_name` - from `package_name`, `selected_package`, etc.
  - `customer_name` - from `customer_name`, `name`, or `first_name + last_name`
- Status is set to `'pending'`
- Profit is set to `0` (not completed yet)

### 2. Order Completion → Profit Accumulation

When you mark an order as completed:
- Status changes to `'completed'`
- `completed_at` timestamp is set
- Profit is calculated from `form_response_items` and stored
- **This profit now counts toward dashboard totals**

### 3. Dashboard Profit Calculation

The dashboard only counts profit from:
- Form responses with `status = 'completed'`
- Filtered by organization and date range

## Migration Steps

### Step 1: Run the SQL Script

```bash
# In Supabase SQL Editor, run:
scripts/create-form-responses-schema.sql
```

This will:
- Drop old `orders`, `order_items`, and `abandoned_carts` tables
- Create new `form_responses` and `form_response_items` tables
- Set up automatic triggers for constants extraction and profit calculation
- Set up RLS policies

### Step 2: Update Edge Function

The Edge Function has already been updated to use `form_responses`. Just redeploy:

```bash
# If using Supabase CLI
supabase functions deploy create-order-from-form
```

### Step 3: Update Frontend Components

Components that display orders/abandoned carts need to be updated to query `form_responses` instead.

## Example: Creating a Form Response

### Input (from form submission)

```json
{
  "form_token": "form_live_abc123",
  "customer_name": "John Doe",
  "customer_phone": "+2348012345678",
  "field_values": {
    "customer_name": "John Doe",
    "customer_phone": "+2348012345678",
    "location": "Lagos, Nigeria",
    "package_type": "premium"
  },
  "items": [
    {
      "product_id": "550e8400-...",
      "quantity": 2
    }
  ]
}
```

### What Gets Stored

**form_responses:**
- `field_values`: All form data (JSONB)
- `phone_number`: "+2348012345678" (extracted)
- `package_name`: "premium" (extracted)
- `customer_name`: "John Doe" (extracted)
- `status`: "pending"
- `profit`: 0 (not completed)

**form_response_items:**
- Product with price snapshots
- Calculated profit per item

### After Marking as Completed

```typescript
// Update status to completed
await supabase
  .from('form_responses')
  .update({ status: 'completed' })
  .eq('id', responseId);

// Profit is automatically calculated and stored
// Now counts toward dashboard!
```

## Querying Form Responses

### Get All Orders

```typescript
const { data } = await supabase
  .from('form_responses')
  .select('*')
  .eq('organization_id', orgId)
  .eq('response_type', 'order')
  .order('created_at', { ascending: false });
```

### Get Abandoned Carts

```typescript
const { data } = await supabase
  .from('form_responses')
  .select('*')
  .eq('organization_id', orgId)
  .eq('response_type', 'abandoned_cart')
  .eq('status', 'abandoned');
```

### Get Completed Orders (with Profit)

```typescript
const { data } = await supabase
  .from('form_responses')
  .select('*, form_response_items(*)')
  .eq('organization_id', orgId)
  .eq('status', 'completed')
  .eq('response_type', 'order');
```

### Access Custom Fields

```typescript
// Access any field from field_values JSONB
const location = response.field_values?.location;
const notes = response.field_values?.additional_notes;
```

## Helper Functions

Use the helper functions in `src/utils/formResponseHelpers.ts`:

```typescript
import {
  extractPhoneNumber,
  extractPackageName,
  extractCustomerName,
  isCompleted,
  countsTowardProfit,
  formatFormResponse
} from '@/utils/formResponseHelpers';

// Extract constants from field_values
const phone = extractPhoneNumber(response.field_values);
const packageName = extractPackageName(response.field_values);

// Check if profit counts
if (countsTowardProfit(response.response_type, response.status)) {
  // This response counts toward dashboard profit
}
```

## Important Notes

1. **Profit Only Counts When Completed**: Only form responses with `status = 'completed'` contribute to dashboard profit
2. **Constants Are Extracted Automatically**: Database triggers handle extraction, but you can also use helper functions
3. **All Form Data Is Preserved**: Everything is stored in `field_values` JSONB, so you never lose data
4. **Price Snapshots**: Prices are snapshotted at submission time for accurate profit calculations

## Troubleshooting

### Profit is 0 even after completion

- Check that `form_response_items` exist and have profit calculated
- Verify status is actually `'completed'`
- Check that the trigger ran (profit should auto-calculate)

### Constants not extracted

- Check that field names match expected patterns (see `FORM_RESPONSES_ARCHITECTURE.md`)
- Verify the trigger is enabled: `extract_form_response_constants_trigger`

### Dashboard profit incorrect

- Ensure you're filtering by `status = 'completed'`
- Check date range filters are correct
- Verify organization_id filter is applied
