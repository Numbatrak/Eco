# WordPress Fluent Form Integration with Supabase

This guide explains how to integrate your WordPress Fluent Form with Supabase to track abandoned carts and submit orders.

## Two Integration Options

### Option 1: Direct REST API (Simple)

Uses Supabase REST API directly with anon key. Quick to set up, but requires RLS configuration.

### Option 2: Edge Function (Recommended - More Secure)

Uses Supabase Edge Functions. More secure, better error handling, and doesn't expose your anon key.

---

## Option 1: Direct REST API Setup

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (this is safe to use in client-side code)

### Step 2: Update the Script

1. Open `scripts/wordpressCartAbandonment.js`
2. Replace these values at the top of the file:
   ```javascript
   const SUPABASE_URL = "https://tgyetavhkukcclnwrroz.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-key-here";
   ```

### Step 3: Add Script to WordPress

---

## Option 2: Edge Function Setup (Recommended)

### Step 1: Deploy the Edge Function

1. Install Supabase CLI (if not already installed):

   ```bash
   npm install -g supabase
   ```

2. Link your project:

   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Deploy the function:

   ```bash
   supabase functions deploy create-order
   ```

   Or manually:

   - Go to Supabase Dashboard → Edge Functions
   - Create a new function called `create-order`
   - Copy the code from `supabase/functions/create-order/index.ts`
   - Deploy

### Step 2: Update the Script

1. Open `scripts/wordpressCartAbandonment-edge-function.js`
2. Replace this value:
   ```javascript
   const SUPABASE_URL = "https://tgyetavhkukcclnwrroz.supabase.co";
   ```
   The Edge Function URL will be automatically constructed.

### Step 3: Add Script to WordPress

You have several options:

#### Option A: Via Plugin (Recommended)

1. Install a plugin like "Insert Headers and Footers" or "Code Snippets"
2. Add the script to the footer section
3. Save and activate

#### Option B: Via Theme

1. Go to **Appearance** → **Theme Editor**
2. Edit `footer.php`
3. Add the script before `</body>` tag

#### Option C: Via Custom HTML Block

1. Add a Custom HTML block to your page
2. Wrap the script in `<script>` tags
3. Place it after the Fluent Form

### Step 4: Verify RLS Policies

**For Option 1 (Direct REST API):**
Make sure your `orders` table allows inserts. If you have RLS enabled, you may need to:

1. Go to Supabase SQL Editor
2. Run this to allow public inserts (if needed):
   ```sql
   CREATE POLICY "Allow public inserts for orders"
   ON orders FOR INSERT
   TO authenticated, anon
   WITH CHECK (true);
   ```

**For Option 2 (Edge Function):**
No RLS configuration needed! The Edge Function uses the service role key which bypasses RLS automatically.

## How It Works

### Abandoned Cart Tracking

- Tracks when users fill out form fields but don't submit
- After 30 seconds of inactivity, creates a "Pending" order with note "Abandoned Cart"
- Includes all filled form data

### Form Submission

- When form is submitted, creates a "Pending" order
- Waits for Supabase to save before allowing form redirect
- Includes all form data mapped to your orders table

## Data Mapping

The script maps Fluent Form fields to your orders table:

| Fluent Form Field                        | Orders Table Column                       |
| ---------------------------------------- | ----------------------------------------- |
| `names[first_name]` + `names[last_name]` | `customer_name`                           |
| `numeric_field` or `numeric_field_1`     | `phone_number`                            |
| `input_text` + `input_text_1`            | `location`                                |
| `input_radio` (selected package)         | `product_name`, `quantity`, `sales_price` |
| `input_radio_1` (selected items)         | `product2`, `quantity2`                   |
| Auto-generated                           | `order_date`, `order_month`, `order_year` |
| Auto-set                                 | `order_status` = "Pending"                |

## Troubleshooting

### Orders not appearing in database

1. Check browser console for errors
2. Verify Supabase URL and key are correct
3. Check RLS policies allow inserts
4. Verify the form selector `.fluentform` matches your form

### Script not running

1. Check if script is loaded (view page source)
2. Check browser console for errors
3. Verify Fluent Form is using class `.fluentform`
4. Try increasing the wait timeout in `waitForForm()`

### Form not submitting

1. Check if Supabase request is blocking
2. Try reducing the delay before re-submission
3. Check browser console for errors

## Security Notes

- The anon key is safe to use in client-side code
- RLS policies will still apply
- Consider creating a dedicated service role endpoint for more control
- Never use the service role key in client-side code

## Testing

1. Fill out the form partially
2. Wait 30+ seconds without submitting
3. Check Supabase orders table for abandoned cart entry
4. Fill out and submit the form
5. Check Supabase orders table for new order entry
