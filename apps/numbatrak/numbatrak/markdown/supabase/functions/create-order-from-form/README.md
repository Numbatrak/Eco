# Create Order from Form - Edge Function

This Supabase Edge Function creates orders from form submissions with proper price snapshots, profit calculations, and security validation.

## Features

✅ **Form Token Validation** - Validates public form tokens and ensures forms are active  
✅ **Organization Scoping** - Ensures all products belong to the form's organization  
✅ **Price Snapshots** - Captures current prices at order creation time (immutable)  
✅ **Profit Calculation** - Calculates profit correctly even if prices change later  
✅ **RLS Enforcement** - Validates organization membership and product ownership  
✅ **Transaction Safety** - Rolls back order creation if order_items fail  

## Request Format

```typescript
POST /functions/v1/create-order-from-form
Content-Type: application/json

{
  "form_token": "form_live_98Fh3ksd",
  "customer_name": "John Doe",
  "customer_phone": "+1234567890",
  "source": "wordpress", // optional, defaults to "wordpress"
  "field_values": { // optional, for storing additional form data
    "email": "john@example.com",
    "address": "123 Main St"
  },
  "items": [
    {
      "product_id": "uuid-here",
      "quantity": 2
    },
    {
      "product_id": "another-uuid",
      "quantity": 1
    }
  ]
}
```

## Response Format

### Success (200)

```json
{
  "success": true,
  "order": {
    "id": "order-uuid",
    "organization_id": "org-uuid",
    "source": "wordpress",
    "status": "pending",
    "customer_name": "John Doe",
    "customer_phone": "+1234567890",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "order_items": [
    {
      "id": "item-uuid",
      "order_id": "order-uuid",
      "product_id": "product-uuid",
      "quantity": 2,
      "unit_price_at_order": 100.00,
      "unit_cost_at_order": 50.00,
      "total_price": 200.00,
      "total_cost": 100.00,
      "profit": 100.00
    }
  ],
  "totals": {
    "total_price": 200.00,
    "total_cost": 100.00,
    "profit": 100.00
  },
  "message": "Order created successfully with price snapshots"
}
```

### Error Responses

#### Invalid Form Token (404)
```json
{
  "error": "Invalid or not found form token"
}
```

#### Form Not Active (400)
```json
{
  "error": "Form is not active"
}
```

#### Products Don't Belong to Organization (403)
```json
{
  "error": "Some products do not belong to the form's organization",
  "invalid_products": [
    {
      "id": "product-uuid",
      "name": "Product Name"
    }
  ]
}
```

#### Missing Required Fields (400)
```json
{
  "error": "Missing required field: form_token"
}
```

## How It Works

### 1. Form Token Validation
- Looks up form by `form_token`
- Verifies form is active
- Extracts `organization_id` from form

### 2. Product Validation
- Fetches all products by IDs
- Verifies all products belong to the same organization as the form
- Verifies all products are active
- Ensures all requested products exist

### 3. Price Snapshot
- For each product, fetches the latest active price from `product_price_history`
  - Looks for records where `ends_at IS NULL` (currently active)
- Falls back to `products.base_price` and `products.cost_price` if no history exists
- **This snapshot is immutable** - even if prices change tomorrow, this order's profit stays accurate

### 4. Order Creation
- Creates order with:
  - `organization_id` (from form)
  - `source` (default: "wordpress")
  - `status` (default: "pending")
  - Customer information

### 5. Order Items Creation
- For each item, creates an `order_item` with:
  - `unit_price_at_order` - Snapshot of price at order time
  - `unit_cost_at_order` - Snapshot of cost at order time
  - `total_price` - `quantity × unit_price_at_order`
  - `total_cost` - `quantity × unit_cost_at_order`
  - `profit` - `total_price - total_cost`

### 6. Transaction Safety
- If order_items creation fails, the order is automatically deleted (rollback)
- Ensures data consistency

## Security

### Row-Level Security (RLS)
- Edge Function uses service role key (bypasses RLS for validation)
- Still validates organization scoping manually
- All operations respect organization boundaries

### Validation Checks
- ✅ Form token exists and is active
- ✅ Products belong to form's organization
- ✅ Products are active
- ✅ Quantities are valid (positive integers)
- ✅ All products exist

### Rate Limiting
- Should be implemented at the API Gateway level
- Consider rate limiting by:
  - IP address
  - Form token
  - Organization ID

## Database Schema Requirements

This function requires the following tables:

### `forms`
```sql
CREATE TABLE forms (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  form_token TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  ...
);
```

### `products`
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  ...
);
```

### `product_price_history`
```sql
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ, -- NULL means currently active
  ...
);
```

### `orders`
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  source TEXT NOT NULL DEFAULT 'wordpress',
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ...
);
```

### `order_items`
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price_at_order DECIMAL(10, 2) NOT NULL,
  unit_cost_at_order DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  profit DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Deployment

### Using Supabase CLI

```bash
# Deploy the function
supabase functions deploy create-order-from-form

# Set environment variables (if needed)
supabase secrets set SUPABASE_URL=your-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Using Supabase Dashboard

1. Go to **Edge Functions** in your Supabase dashboard
2. Click **Create a new function**
3. Name it `create-order-from-form`
4. Copy the code from `index.ts`
5. Deploy

## Testing

### Using cURL

```bash
curl -X POST \
  https://tgyetavhkukcclnwrroz.supabase.co/functions/v1/create-order-from-form \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "form_token": "form_live_98Fh3ksd",
    "customer_name": "John Doe",
    "customer_phone": "+1234567890",
    "items": [
      {
        "product_id": "product-uuid-here",
        "quantity": 2
      }
    ]
  }'
```

### Using JavaScript (from embed.js)

```javascript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/create-order-from-form`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({
      form_token: 'form_live_98Fh3ksd',
      customer_name: 'John Doe',
      customer_phone: '+1234567890',
      items: [
        { product_id: 'product-uuid', quantity: 2 }
      ]
    })
  }
);

const result = await response.json();
```

## Error Handling

The function handles various error scenarios:

- **400 Bad Request**: Missing fields, invalid data, inactive products
- **403 Forbidden**: Products don't belong to organization
- **404 Not Found**: Form token or products not found
- **500 Internal Server Error**: Database errors, unexpected failures

All errors include descriptive messages to help with debugging.

## Notes

- **Price Snapshots**: The most important feature - prices are captured at order creation time and never change, ensuring accurate historical profit tracking
- **Incentives**: Incentive products (type='INCENTIVE') with zero prices will have negative profit (cost only), which is correct
- **Transaction Safety**: If order_items creation fails, the order is automatically rolled back
- **Organization Scoping**: All validation ensures products belong to the form's organization
