# Import Scripts

These scripts import data from various sources into your Supabase database.

## Setup

To run these scripts, you need to add your Supabase Service Role Key to your `.env` file:

1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the `service_role` key (NOT the anon key - this bypasses Row Level Security)
4. Add it to your `.env` file:

```
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important**: The service role key bypasses Row Level Security (RLS), which is necessary for bulk imports. Keep this key secret and never commit it to version control.

## Import Waybills

This script imports waybill data from `src/data/waybills-data.txt` into your Supabase database.

```bash
npm run import:waybills
```

The script will:
- Parse the waybill data file
- Create agents (with location mapping) if they don't exist
- Create products if they don't exist
- Create all delivery records
- Show progress and results

## Import Orders

You have two options for importing orders:

### Option 1: Using the Import Script (Recommended)

This script imports order data from a CSV file into your Supabase database.

```bash
node scripts/importOrders.js "/path/to/your/orders.csv"
```

Example:
```bash
node scripts/importOrders.js "/Users/macbookpro/Downloads/Copy of Test - Ilezen - Nuella.csv"
```

The script will:
- Parse the CSV file
- Convert CSV rows to order format (handles column name mapping automatically)
- Insert orders into the database in batches
- Show progress and results

**Note**: Make sure the `orders` table exists in your Supabase database. The script will provide the SQL schema if the table doesn't exist.

### Option 2: Direct CSV Import via Supabase UI

If you prefer to use Supabase's built-in CSV import feature:

1. **Create the table with CSV-matching column names:**
   - Go to Supabase SQL Editor
   - Run `scripts/createOrdersTableForCSVImport.sql`
   - This creates a table with column names that exactly match your CSV headers

2. **Import the CSV:**
   - Go to Table Editor → `orders`
   - Click "Import data" or use the Import button
   - Select your CSV file
   - The import should work since column names match

3. **Migrate to standard schema (optional but recommended):**
   - After import, run `scripts/migrateOrdersToStandardSchema.sql`
   - This converts the Pascal_Case columns to snake_case (standard database convention)
   - Your application code expects snake_case column names

**Note**: The import script (Option 1) is recommended because it handles all the mapping automatically and doesn't require the migration step.

## Troubleshooting

If you see RLS (Row Level Security) errors, make sure you're using the `VITE_SUPABASE_SERVICE_ROLE_KEY` instead of the anon key.


