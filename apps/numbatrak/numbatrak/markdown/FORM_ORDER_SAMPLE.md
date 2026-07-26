# Sample Order from Form Submission

This document shows what a complete order looks like when submitted from the embed form.

## 1. Form Submission Payload

When a user submits the form, the SDK sends this payload to the Edge Function:

```json
{
  "form_token": "form_live_abc123xyz",
  "customer_name": "John Doe",
  "customer_phone": "+2348012345678",
  "field_values": {
    "customer_name": "John Doe",
    "customer_phone": "+2348012345678",
    "location": "Lagos, Nigeria",
    "package_type": "premium", // From radio group selection
    "additional_notes": "Please deliver before 5pm"
  },
  "items": [
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440000", // UUID
      "quantity": 2
    },
    {
      "product_id": "660e8400-e29b-41d4-a716-446655440001", // UUID
      "quantity": 1
    }
  ],
  "source": "wordpress" // Optional, defaults to "wordpress"
}
```

## 2. Edge Function Processing

The Edge Function (`create-order-from-form`):

1. Validates the form token and organization
2. Validates all products belong to the organization
3. Fetches current active prices for each product (price snapshot)
4. Creates the order record
5. Creates order_items with price snapshots
6. Calculates totals

## 3. Database Records Created

### 3.1. Order Record (`orders` table)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "organization_id": "org-123-456-789",
  "source": "wordpress",
  "status": "pending",
  "customer_name": "John Doe",
  "customer_phone": "+2348012345678",
  "location": "Lagos, Nigeria", // Extracted from field_values.location or field_values.delivery_address
  "created_at": "2026-01-26T10:30:00.000Z",
  "updated_at": "2026-01-26T10:30:00.000Z"
}
```

**SQL Structure:**

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'wordpress',
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  location TEXT,  -- Added via migration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2. Order Items Records (`order_items` table)

Each product in the order gets its own `order_items` record with **price snapshots**:

**Item 1:**

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "order_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "quantity": 2,
  "unit_price_at_order": 1500.0, // Snapshot: price at order time
  "unit_cost_at_order": 1000.0, // Snapshot: cost at order time
  "total_price": 3000.0, // quantity * unit_price_at_order
  "total_cost": 2000.0, // quantity * unit_cost_at_order
  "profit": 1000.0, // total_price - total_cost
  "created_at": "2026-01-26T10:30:00.000Z"
}
```

**Item 2:**

```json
{
  "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "order_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "product_id": "660e8400-e29b-41d4-a716-446655440001",
  "quantity": 1,
  "unit_price_at_order": 2500.0,
  "unit_cost_at_order": 1800.0,
  "total_price": 2500.0,
  "total_cost": 1800.0,
  "profit": 700.0,
  "created_at": "2026-01-26T10:30:00.000Z"
}
```

**SQL Structure:**

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price_at_order DECIMAL(10, 2) NOT NULL,  -- Price snapshot
  unit_cost_at_order DECIMAL(10, 2) NOT NULL,    -- Cost snapshot
  total_price DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  profit DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. Edge Function Response

The Edge Function returns this response:

```json
{
  "success": true,
  "order": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organization_id": "org-123-456-789",
    "source": "wordpress",
    "status": "pending",
    "customer_name": "John Doe",
    "customer_phone": "+2348012345678",
    "created_at": "2026-01-26T10:30:00.000Z"
  },
  "order_items": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "order_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "quantity": 2,
      "unit_price_at_order": 1500.0,
      "unit_cost_at_order": 1000.0,
      "total_price": 3000.0,
      "total_cost": 2000.0,
      "profit": 1000.0,
      "created_at": "2026-01-26T10:30:00.000Z"
    },
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "order_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "product_id": "660e8400-e29b-41d4-a716-446655440001",
      "quantity": 1,
      "unit_price_at_order": 2500.0,
      "unit_cost_at_order": 1800.0,
      "total_price": 2500.0,
      "total_cost": 1800.0,
      "profit": 700.0,
      "created_at": "2026-01-26T10:30:00.000Z"
    }
  ],
  "totals": {
    "total_price": 5500.0, // Sum of all order_items.total_price
    "total_cost": 3800.0, // Sum of all order_items.total_cost
    "profit": 1700.0 // Sum of all order_items.profit
  },
  "message": "Order created successfully with price snapshots"
}
```

## 5. Key Features

### 5.1. Price Snapshotting

- Prices are **snapshot at order time** from `product_price_history` table
- If no price history exists, falls back to `products.base_price` and `products.cost_price`
- This ensures historical accuracy even if prices change later

### 5.2. Field Values Storage

- All form field values are stored in `field_values` JSONB in the request
- The `location` field is extracted and stored in `orders.location`
- Other custom fields can be accessed via `field_values` in the request payload

### 5.3. Radio Group Products

- When a radio option is selected, its associated products are automatically added to `items`
- Products are identified by UUID (not integers)
- Quantities come from the radio option's product configuration

### 5.4. Validation

- Form token must be valid and active
- All products must belong to the form's organization
- All products must be active
- Quantities must be > 0
- At least one product must be selected

## 6. Complete Example Flow

```
1. User fills form:
   - Name: "John Doe"
   - Phone: "+2348012345678"
   - Location: "Lagos, Nigeria"
   - Selects radio option "Premium Package" (which includes 2 products)

2. Form SDK collects:
   - customer_name: "John Doe"
   - customer_phone: "+2348012345678"
   - field_values: { location: "Lagos, Nigeria", package_type: "premium", ... }
   - items: [
       { product_id: "550e8400-...", quantity: 2 },
       { product_id: "660e8400-...", quantity: 1 }
     ]

3. Edge Function:
   - Validates form and products
   - Fetches current prices for products
   - Creates order record
   - Creates 2 order_items records with price snapshots
   - Returns success response

4. Database contains:
   - 1 order record
   - 2 order_items records
   - All prices are snapshotted at order time
```

## 7. Querying Orders

To get a complete order with items:

```sql
SELECT
  o.*,
  json_agg(
    json_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'quantity', oi.quantity,
      'unit_price_at_order', oi.unit_price_at_order,
      'unit_cost_at_order', oi.unit_cost_at_order,
      'total_price', oi.total_price,
      'total_cost', oi.total_cost,
      'profit', oi.profit
    )
  ) as items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
GROUP BY o.id;
```

## 8. Notes

- **Product IDs are UUIDs**, not integers
- **Prices are snapshotted** at order time for historical accuracy
- **Location** is extracted from `field_values.location` or `field_values.delivery_address`
- **Source** defaults to "wordpress" but can be customized
- **Status** is always "pending" when created from form
- All calculations (total_price, total_cost, profit) are done server-side and validated with database constraints
