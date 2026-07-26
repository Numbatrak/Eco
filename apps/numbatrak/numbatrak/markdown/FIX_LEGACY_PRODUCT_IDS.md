# Fix: Legacy Numeric Product IDs

## Problem
Your form has legacy numeric product IDs (like "1", "2") instead of UUID product IDs. The system now requires UUIDs, so these are being rejected.

## Error Messages You'll See
```
ERROR: Skipping legacy numeric product ID: 1 - Form needs to be updated with UUID product IDs
ERROR: Skipping legacy numeric product ID: 2 - Form needs to be updated with UUID product IDs
ERROR: No valid products were added. All products were rejected.
```

## Solution: Update Your Form

### Step 1: Open Form Builder
1. Go to your CRM dashboard
2. Navigate to Forms
3. Find and edit the form that's having issues

### Step 2: Update Radio Options
For each radio option that has products attached:

1. **Expand the radio option** (click the Products section)
2. **Remove old products** with numeric IDs:
   - Click the trash icon next to each product
   - Or clear all products from that option
3. **Re-attach products**:
   - Click "Add Product"
   - Select products from the dropdown (these will have UUID IDs)
   - Set the quantity
4. **Save the form**

### Step 3: Verify
After updating:
- Product IDs should look like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- Not like: `1`, `2`, `3`, etc.

## Quick Fix Script (Optional)

If you have many forms to update, you can run this SQL to find all forms with legacy product IDs:

```sql
-- Find forms with legacy numeric product IDs
SELECT 
  id,
  name,
  form_token,
  schema->'fields' as fields
FROM forms
WHERE schema::text LIKE '%"product_id": "1"%'
   OR schema::text LIKE '%"product_id": "2"%'
   OR schema::text LIKE '%"product_id": "3"%'
   OR schema::text ~ '"product_id":\s*"[0-9]+"';
```

**Note:** Manual update via the form builder is recommended to ensure products are correctly mapped.

## Why This Happened

- Products used to have numeric IDs (1, 2, 3...)
- The system was migrated to use UUID IDs
- Old forms still have references to the numeric IDs
- These need to be updated to use the new UUID product IDs

## Prevention

Going forward:
- Always use the form builder to attach products
- Never manually edit product IDs in the form schema
- The form builder automatically uses UUID product IDs
