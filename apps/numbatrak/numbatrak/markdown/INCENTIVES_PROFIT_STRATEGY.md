# Incentives & Profit Calculation Strategy

Comprehensive data model and calculation strategy for handling zero-priced incentive products without breaking profit analytics.

## Overview

Incentives (free items, bonuses, discounts) are treated as **products with special pricing** rather than separate entities. This unified approach ensures:
- ✅ Accurate profit tracking
- ✅ Clean analytics
- ✅ Inventory management
- ✅ No special cases in calculations

## Data Model

### Products Table

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

**Key Fields:**
- `type`: `'NORMAL'` or `'INCENTIVE'`
- `base_price`: Can be `0.00` for free incentives
- `cost_price`: Always tracked (even for free items)

### Product Price History

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
```

**Incentive Price History:**
- Incentives can have price history (for promotional periods)
- `price = 0.00` means free
- `cost_price` always tracked (cost to provide incentive)

### Order Items (Snapshot Fields)

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  
  -- SNAPSHOT FIELDS (immutable)
  unit_price_at_order DECIMAL(10, 2) NOT NULL,
  unit_cost_at_order DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  profit DECIMAL(10, 2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**For Incentives:**
- `unit_price_at_order` = `0.00` (free)
- `unit_cost_at_order` = actual cost (e.g., `5.00`)
- `total_price` = `0.00`
- `total_cost` = `quantity × unit_cost_at_order`
- `profit` = `0.00 - total_cost` = **negative** (represents incentive cost)

## Profit Calculation Strategy

### Core Formula

For **each order item**:
```sql
profit = total_price - total_cost
```

Where:
- `total_price = quantity × unit_price_at_order`
- `total_cost = quantity × unit_cost_at_order`

### For Normal Products

```
Product: Widget
- unit_price_at_order: 100.00
- unit_cost_at_order: 50.00
- quantity: 2

Calculation:
- total_price = 2 × 100.00 = 200.00
- total_cost = 2 × 50.00 = 100.00
- profit = 200.00 - 100.00 = 100.00 ✅
```

### For Incentive Products (Zero Price)

```
Incentive: Free Gift
- unit_price_at_order: 0.00 (free)
- unit_cost_at_order: 5.00 (cost to provide)
- quantity: 1

Calculation:
- total_price = 1 × 0.00 = 0.00
- total_cost = 1 × 5.00 = 5.00
- profit = 0.00 - 5.00 = -5.00 ✅ (negative = incentive cost)
```

### Mixed Order Example

```
Order with:
1. Widget (normal): quantity=2, price=100, cost=50
2. Free Gift (incentive): quantity=1, price=0, cost=5

Item 1 (Widget):
- total_price = 200.00
- total_cost = 100.00
- profit = 100.00

Item 2 (Free Gift):
- total_price = 0.00
- total_cost = 5.00
- profit = -5.00

Order Totals:
- total_price = 200.00
- total_cost = 105.00
- total_profit = 95.00 ✅ (100.00 - 5.00)
```

**Key Insight:** The incentive cost is properly deducted from total profit.

## SQL Queries for Analytics

### Total Profit by Product Type

```sql
SELECT 
  p.type,
  COUNT(oi.id) as order_count,
  SUM(oi.total_price) as total_revenue,
  SUM(oi.total_cost) as total_cost,
  SUM(oi.profit) as total_profit,
  AVG(oi.profit) as avg_profit_per_item
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY p.type;
```

**Expected Results:**
- `NORMAL`: Positive profit
- `INCENTIVE`: Negative profit (incentive costs)

### Order Profit Breakdown

```sql
SELECT 
  o.id as order_id,
  o.customer_name,
  SUM(CASE WHEN p.type = 'NORMAL' THEN oi.total_price ELSE 0 END) as normal_revenue,
  SUM(CASE WHEN p.type = 'NORMAL' THEN oi.total_cost ELSE 0 END) as normal_cost,
  SUM(CASE WHEN p.type = 'NORMAL' THEN oi.profit ELSE 0 END) as normal_profit,
  SUM(CASE WHEN p.type = 'INCENTIVE' THEN oi.total_price ELSE 0 END) as incentive_revenue,
  SUM(CASE WHEN p.type = 'INCENTIVE' THEN oi.total_cost ELSE 0 END) as incentive_cost,
  SUM(CASE WHEN p.type = 'INCENTIVE' THEN oi.profit ELSE 0 END) as incentive_profit,
  SUM(oi.total_price) as total_revenue,
  SUM(oi.total_cost) as total_cost,
  SUM(oi.profit) as total_profit
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY o.id, o.customer_name;
```

### Incentive Cost Analysis

```sql
SELECT 
  p.name as incentive_name,
  COUNT(oi.id) as times_used,
  SUM(oi.quantity) as total_quantity_given,
  SUM(oi.total_cost) as total_incentive_cost,
  AVG(oi.unit_cost_at_order) as avg_cost_per_unit
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE p.type = 'INCENTIVE'
GROUP BY p.id, p.name
ORDER BY total_incentive_cost DESC;
```

### Profit Margin by Product Type

```sql
SELECT 
  p.type,
  SUM(oi.total_price) as total_revenue,
  SUM(oi.total_cost) as total_cost,
  SUM(oi.profit) as total_profit,
  CASE 
    WHEN SUM(oi.total_price) > 0 
    THEN (SUM(oi.profit) / SUM(oi.total_price)) * 100
    ELSE NULL
  END as profit_margin_percent
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY p.type;
```

**Note:** Incentives will have `NULL` margin (division by zero), which is correct.

## Edge Cases & Handling

### Case 1: Free Incentive with Zero Cost

```
Incentive: Digital Download (no cost)
- unit_price_at_order: 0.00
- unit_cost_at_order: 0.00
- quantity: 1

Calculation:
- total_price = 0.00
- total_cost = 0.00
- profit = 0.00 ✅ (neutral, no impact)
```

### Case 2: Discounted Incentive (Not Free)

```
Incentive: 50% Off Upsell
- unit_price_at_order: 10.00 (discounted from 20.00)
- unit_cost_at_order: 15.00
- quantity: 1

Calculation:
- total_price = 10.00
- total_cost = 15.00
- profit = -5.00 ✅ (negative = loss on incentive)
```

### Case 3: Incentive with Higher Cost Than Price

```
Incentive: Buy One Get One (BOGO)
- Main product: price=100, cost=50, profit=50
- Free item: price=0, cost=30, profit=-30

Order Total:
- total_price = 100.00
- total_cost = 80.00
- total_profit = 20.00 ✅ (50 - 30)
```

### Case 4: Multiple Incentives in One Order

```
Order:
1. Product A (normal): price=100, cost=50, profit=50
2. Free Gift 1: price=0, cost=5, profit=-5
3. Free Gift 2: price=0, cost=3, profit=-3

Total:
- total_price = 100.00
- total_cost = 58.00
- total_profit = 42.00 ✅ (50 - 5 - 3)
```

## Implementation in Edge Function

### Price Snapshot Logic

```typescript
// In create-order-from-form Edge Function

for (const item of body.items) {
  const product = products.find(p => p.id === item.product_id);
  const priceSnapshot = priceMap.get(item.product_id);
  
  const unitPrice = priceSnapshot.price; // Can be 0.00 for incentives
  const unitCost = priceSnapshot.cost_price; // Always tracked
  const quantity = item.quantity;
  
  const totalPrice = unitPrice * quantity;
  const totalCost = unitCost * quantity;
  const profit = totalPrice - totalCost; // Can be negative for incentives
  
  orderItems.push({
    order_id: order.id,
    product_id: item.product_id,
    quantity: quantity,
    unit_price_at_order: unitPrice,
    unit_cost_at_order: unitCost,
    total_price: totalPrice,
    total_cost: totalCost,
    profit: profit // ✅ Negative for free incentives is correct
  });
}
```

## Analytics Considerations

### 1. Revenue Reporting

**Include Incentives:**
```sql
-- Total revenue (includes zero-priced incentives)
SELECT SUM(total_price) FROM order_items;
-- Result: 1000.00 (incentives show as 0.00)
```

**Exclude Incentives:**
```sql
-- Revenue from normal products only
SELECT SUM(total_price) 
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE p.type = 'NORMAL';
-- Result: 1000.00 (incentives excluded)
```

### 2. Profit Reporting

**Total Profit (Including Incentive Costs):**
```sql
SELECT SUM(profit) FROM order_items;
-- Result: 950.00 (incentive costs deducted)
```

**Profit by Type:**
```sql
SELECT 
  p.type,
  SUM(oi.profit) as profit
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY p.type;
-- NORMAL: 1000.00
-- INCENTIVE: -50.00
```

### 3. Cost Analysis

**Total Cost (Including Incentives):**
```sql
SELECT SUM(total_cost) FROM order_items;
-- Includes both product costs and incentive costs
```

**Incentive Cost Tracking:**
```sql
SELECT 
  SUM(oi.total_cost) as total_incentive_cost
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE p.type = 'INCENTIVE';
```

## Best Practices

### 1. Always Track Cost Price

Even for free incentives, always set `cost_price`:
- `0.00` if truly no cost (digital items)
- Actual cost if physical item or service

### 2. Use Negative Profit for Incentives

Negative profit on incentives is **correct**:
- Represents the cost of providing the incentive
- Properly deducted from total profit
- Allows accurate ROI analysis

### 3. Separate Analytics Views

Create separate views for:
- **Revenue Analysis**: Filter by `type = 'NORMAL'`
- **Cost Analysis**: Include all types
- **Profit Analysis**: Include all types (shows true profit)

### 4. Incentive ROI Calculation

```sql
-- Calculate ROI of incentives
SELECT 
  SUM(CASE WHEN p.type = 'NORMAL' THEN oi.profit ELSE 0 END) as normal_profit,
  SUM(CASE WHEN p.type = 'INCENTIVE' THEN ABS(oi.profit) ELSE 0 END) as incentive_cost,
  SUM(CASE WHEN p.type = 'NORMAL' THEN oi.profit ELSE 0 END) - 
  SUM(CASE WHEN p.type = 'INCENTIVE' THEN ABS(oi.profit) ELSE 0 END) as net_profit,
  CASE 
    WHEN SUM(CASE WHEN p.type = 'INCENTIVE' THEN ABS(oi.profit) ELSE 0 END) > 0
    THEN (SUM(CASE WHEN p.type = 'NORMAL' THEN oi.profit ELSE 0 END) / 
          SUM(CASE WHEN p.type = 'INCENTIVE' THEN ABS(oi.profit) ELSE 0 END)) * 100
    ELSE NULL
  END as roi_percent
FROM order_items oi
JOIN products p ON p.id = oi.product_id;
```

## Validation Rules

### Product Creation

```sql
-- Ensure cost_price is always set (even for free items)
ALTER TABLE products 
ADD CONSTRAINT check_cost_price_not_null 
CHECK (cost_price IS NOT NULL);

-- Ensure base_price >= 0 (can be zero for free incentives)
ALTER TABLE products 
ADD CONSTRAINT check_base_price_non_negative 
CHECK (base_price >= 0);

-- Ensure cost_price >= 0
ALTER TABLE products 
ADD CONSTRAINT check_cost_price_non_negative 
CHECK (cost_price >= 0);
```

### Order Item Validation

```sql
-- Ensure profit calculation is correct
ALTER TABLE order_items 
ADD CONSTRAINT check_profit_calculation 
CHECK (profit = (total_price - total_cost));

-- Ensure totals are calculated correctly
ALTER TABLE order_items 
ADD CONSTRAINT check_total_price_calculation 
CHECK (total_price = (quantity * unit_price_at_order));

ALTER TABLE order_items 
ADD CONSTRAINT check_total_cost_calculation 
CHECK (total_cost = (quantity * unit_cost_at_order));
```

## Summary

### Key Principles

1. **Incentives are Products**: Treat incentives as products with `type = 'INCENTIVE'`
2. **Zero Price is Valid**: `base_price = 0.00` is valid for free incentives
3. **Cost Always Tracked**: `cost_price` is always set (even if `0.00`)
4. **Negative Profit is Correct**: Incentives show negative profit (cost only)
5. **Unified Calculation**: Same formula for all products: `profit = price - cost`
6. **Snapshot Immutability**: Prices captured at order time never change

### Profit Formula

```
For each order item:
  profit = total_price - total_cost

For entire order:
  total_profit = Σ(profit for each item)
  
This works for:
  ✅ Normal products (positive profit)
  ✅ Free incentives (negative profit)
  ✅ Discounted incentives (can be negative)
  ✅ Mixed orders (sums correctly)
```

### Analytics Benefits

- ✅ **Accurate Profit**: Incentive costs properly deducted
- ✅ **Clean Separation**: Filter by `type` for different views
- ✅ **ROI Tracking**: Calculate return on incentive investment
- ✅ **Cost Visibility**: See true cost of providing incentives
- ✅ **No Special Cases**: Same calculation for all products

This strategy ensures incentives are handled correctly without breaking profit analytics, while maintaining data integrity and providing accurate financial reporting.
