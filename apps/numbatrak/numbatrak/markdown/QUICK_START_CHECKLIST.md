# Quick Start Checklist

Simple checklist to get everything up and running.

## ✅ Pre-Flight Checklist

- [ ] Database backup completed
- [ ] Supabase CLI installed
- [ ] WordPress site ready
- [ ] Hosting for embed SDK files ready

## 📋 Step-by-Step Checklist

### Phase 1: Database (15-30 minutes)

**Option A: Fresh Start (Recommended for Non-Production)**
- [ ] **Drop Old Tables & Create New**
  - Open Supabase SQL Editor
  - Run: `scripts/fresh-start.sql` (drops old + creates new in one go)
  - Verify all tables created

**Option B: Keep Old Tables**
- [ ] **Run SQL Script**
  - Open Supabase SQL Editor
  - Run: `scripts/create-new-schema.sql`
  - Verify all tables created

- [ ] **Apply RLS Policies**
  - Run: `scripts/rls-policies-orders-forms.sql`
  - Verify policies created

- [ ] **Verify Setup**
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN ('products', 'orders', 'order_items', 'forms');
  ```

### Phase 2: Edge Function (10 minutes)

- [ ] **Install Supabase CLI**
  ```bash
  npm install -g supabase
  # or
  brew install supabase/tap/supabase
  ```

- [ ] **Login & Link**
  ```bash
  supabase login
  supabase link --project-ref tgyetavhkukcclnwrroz
  ```

- [ ] **Deploy Function**
  ```bash
  supabase functions deploy create-order-from-form
  ```

- [ ] **Verify Deployment**
  - Check Supabase Dashboard → Edge Functions
  - Function should be listed

### Phase 3: Host Embed SDK (10 minutes)

- [ ] **Files Ready** ✅
  - Files are in `public/embed.js` and `public/embed.css`
  - CORS headers configured in `vercel.json`

- [ ] **Deploy to Vercel**
  ```bash
  git add public/embed.js public/embed.css vercel.json
  git commit -m "Add embed SDK files"
  git push
  ```
  - Or deploy via Vercel dashboard

- [ ] **Get Your Deployment URL**
  - After deployment, get your Vercel URL (e.g., `https://your-app.vercel.app`)
  - Or use your custom domain

- [ ] **Test Access** (Replace `YOUR_URL` with your actual Vercel URL)
  ```bash
  curl https://YOUR_URL.vercel.app/embed.js
  curl https://YOUR_URL.vercel.app/embed.css
  ```
  
  **Note**: Don't use `https://yourapp.com` - that's just a placeholder! Use your actual Vercel deployment URL.

### Phase 4: WordPress Plugin (5 minutes)

- [ ] **Install Plugin**

  **Option A: Manual Installation (FTP/cPanel)**
  1. Access your WordPress site via FTP or cPanel File Manager
  2. Navigate to `wp-content/plugins/` directory
  3. Create a new folder: `crm-form-embed`
  4. Upload all files from `scripts/wordpress-plugin/` to `wp-content/plugins/crm-form-embed/`:
     - `crm-form-embed.php` (main plugin file)
     - `block.js` (Gutenberg block - optional)
     - `uninstall.php` (cleanup script)
     - `README.md` (documentation)
  5. Ensure file permissions are correct (644 for files, 755 for directories)

  **Option B: WordPress Admin Upload**
  1. Create a ZIP file of the `scripts/wordpress-plugin/` folder
  2. Go to WordPress Admin → Plugins → Add New
  3. Click "Upload Plugin"
  4. Choose the ZIP file and click "Install Now"
  5. Wait for installation to complete

- [ ] **Activate Plugin**
  1. Go to WordPress Admin → Plugins
  2. Find "CRM Form Embed" in the plugin list
  3. Click "Activate"
  4. You should see a success message

- [ ] **Configure Settings**
  
  1. **Navigate to Settings Page**
     - Go to WordPress Admin → Settings → CRM Form Embed
     - Or click "Settings" link under the plugin name in Plugins page

  2. **Enter Supabase URL**
     - **Field**: "Supabase URL"
     - **Value**: `https://tgyetavhkukcclnwrroz.supabase.co`
     - **Where to find**: Already pre-filled, but verify in Supabase Dashboard → Settings → API → Project URL
     - **Format**: Must start with `https://` and end with `.supabase.co`

  3. **Enter Supabase Anon Key**
     - **Field**: "Supabase Anon Key"
     - **Value**: Your public/anonymous key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
     - **Where to find**: 
       - Supabase Dashboard → Settings → API
       - Look for "anon" or "public" key (NOT the service_role key!)
       - It's safe to use in client-side code
     - **Important**: Copy the entire key (it's a long string)

  4. **Enter Embed JS URL**
     - **Field**: "Embed JS URL"
     - **Value**: `https://app.numbatrak.io/embed.js`
     - **Where to find**: Already pre-filled from Phase 3
     - **Verify**: Test with `curl https://app.numbatrak.io/embed.js`

  5. **Enter Embed CSS URL**
     - **Field**: "Embed CSS URL"
     - **Value**: `https://app.numbatrak.io/embed.css`
     - **Where to find**: Already pre-filled from Phase 3
     - **Verify**: Test with `curl https://app.numbatrak.io/embed.css`

  6. **Save Settings**
     - Click "Save Changes" button at the bottom
     - You should see a success message: "Settings saved."

- [ ] **Verify Configuration**
  
  1. **Check Settings Are Saved**
     - Refresh the settings page
     - All fields should retain their values
     - If values are empty, re-enter and save again

  2. **Test Plugin Files Are Loaded**
     - Create a test page or post
     - Add shortcode: `[crm_form form="test"]` (we'll use real token in Phase 5)
     - View the page
     - Open browser DevTools (F12) → Network tab
     - Look for requests to:
       - `embed.js` (should load successfully)
       - `embed.css` (should load successfully)
     - Check Console tab for any JavaScript errors

  3. **Verify Shortcode Works**
     - The shortcode should render a form container
     - Even if form doesn't load (no valid token yet), you should see:
       - Form container div with ID
       - Loading message or error message
       - No PHP errors

- [ ] **Troubleshooting**

  **Plugin Not Showing in Plugins List**
  - Check file permissions (644 for files, 755 for directories)
  - Verify `crm-form-embed.php` is in `wp-content/plugins/crm-form-embed/`
  - Check for PHP syntax errors in plugin file
  - Look at WordPress debug log: `wp-content/debug.log`

  **Settings Page Not Accessible**
  - Verify plugin is activated
  - Check user has admin permissions
  - Try deactivating and reactivating plugin

  **Settings Not Saving**
  - Check WordPress database connection
  - Verify `wp_options` table exists and is writable
  - Check for plugin conflicts (deactivate other plugins temporarily)

  **SDK Files Not Loading**
  - Verify URLs are correct (no typos)
  - Test URLs directly in browser: `https://app.numbatrak.io/embed.js`
  - Check CORS headers (should see `Access-Control-Allow-Origin: *`)
  - Check browser console for CORS errors
  - Verify WordPress site can make external requests (some hosts block this)

  **Form Not Rendering**
  - This is expected if you haven't created a form yet (Phase 5)
  - Check browser console for specific error messages
  - Verify Supabase URL and Anon Key are correct
  - Test Supabase connection: Check Network tab for API calls to Supabase

## 🔧 WordPress Plugin Troubleshooting Guide

If the plugin doesn't work, follow these steps systematically:

### Step 1: Verify Plugin Installation

**Check Plugin is Activated:**
1. Go to WordPress Admin → Plugins
2. Find "CRM Form Embed" in the list
3. Verify it shows "Activated" (not "Deactivate" button)
4. If not activated, click "Activate"

**Check Plugin Files:**
1. Via FTP/cPanel, verify these files exist:
   - `wp-content/plugins/crm-form-embed/crm-form-embed.php` ✅
   - `wp-content/plugins/crm-form-embed/block.js` (optional)
   - `wp-content/plugins/crm-form-embed/uninstall.php` (optional)
2. Check file permissions: 644 for files, 755 for directories

**Check for PHP Errors:**
1. Enable WordPress debug mode (add to `wp-config.php`):
   ```php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   ```
2. Check `wp-content/debug.log` for errors
3. Look for errors related to "CRM Form Embed" or "crm-form-embed"

### Step 2: Verify Settings Configuration

**Check Settings Page:**
1. Go to WordPress Admin → Settings → CRM Form Embed
2. Verify all fields are filled:
   - ✅ Supabase URL: `https://tgyetavhkukcclnwrroz.supabase.co`
   - ✅ Supabase Anon Key: Should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - ✅ Embed JS URL: `https://app.numbatrak.io/embed.js`
   - ✅ Embed CSS URL: `https://app.numbatrak.io/embed.css`
3. Click "Save Changes" even if values look correct
4. Refresh page and verify values are still there

**Test Settings Directly:**
Add this to a test page temporarily to check settings:
```php
<?php
$settings = get_option('crm_form_embed_settings', array());
echo '<pre>';
print_r($settings);
echo '</pre>';
?>
```
You should see all 4 settings with values.

### Step 3: Check Shortcode Syntax

**Common Shortcode Mistakes:**
- ❌ `[crm-form form="token"]` (wrong: uses hyphen)
- ✅ `[crm_form form="token"]` (correct: uses underscore)

- ❌ `[crm_form form=token]` (wrong: missing quotes)
- ✅ `[crm_form form="token"]` (correct: with quotes)

- ❌ `[crm_form]` (wrong: missing form token)
- ✅ `[crm_form form="form_live_98Fh3ksd"]` (correct: with token)

**Test Shortcode:**
1. Create a test page
2. Add shortcode: `[crm_form form="test"]`
3. View page
4. You should see a div with `data-form-token="test"` (even if form doesn't load)

### Step 4: Check Browser Console (Critical!)

**Open Browser DevTools:**
1. View the page with the shortcode
2. Press F12 (or Right-click → Inspect)
3. Go to Console tab
4. Look for errors (red text)

**Common Console Errors:**

**Error: "CRM_SUPABASE_URL is not defined"**
- **Cause**: Settings not configured or not loading
- **Fix**: 
  1. Go to Settings → CRM Form Embed
  2. Verify Supabase URL is filled
  3. Save settings
  4. Clear browser cache
  5. Reload page

**Error: "Failed to fetch" or CORS error**
- **Cause**: SDK files not loading or CORS issue
- **Fix**:
  1. Check Network tab → Look for `embed.js` and `embed.css`
  2. If 404: Verify URLs in settings are correct
  3. If CORS error: Verify CORS headers on embed files
  4. Test URLs directly: `https://app.numbatrak.io/embed.js`

**Error: "Form not found"**
- **Cause**: Invalid form token or form doesn't exist
- **Fix**:
  1. Verify form token is correct
  2. Check form exists in Supabase database
  3. Verify form is active (`active = true`)

**Error: "Network request failed"**
- **Cause**: Supabase connection issue
- **Fix**:
  1. Verify Supabase URL is correct
  2. Verify Supabase Anon Key is correct
  3. Check Network tab for API calls to Supabase
  4. Test Supabase connection manually

### Step 5: Check Network Tab

**Inspect Network Requests:**
1. Open DevTools → Network tab
2. Reload page
3. Look for these requests:

**Should See:**
- ✅ `embed.js` - Status 200 (loaded successfully)
- ✅ `embed.css` - Status 200 (loaded successfully)
- ✅ Requests to `tgyetavhkukcclnwrroz.supabase.co/rest/v1/forms` (form schema fetch)

**If Missing:**
- `embed.js` not loading:
  - Check Embed JS URL in settings
  - Test URL directly in browser
  - Check CORS headers
  
- `embed.css` not loading:
  - Check Embed CSS URL in settings
  - Test URL directly in browser

- No Supabase API calls:
  - Check Supabase URL and Anon Key
  - Verify JavaScript is executing
  - Check for JavaScript errors in Console

### Step 6: Verify SDK Files Are Accessible

**Test Embed Files:**
```bash
# Test JavaScript file
curl https://app.numbatrak.io/embed.js

# Test CSS file
curl https://app.numbatrak.io/embed.css

# Check CORS headers
curl -I https://app.numbatrak.io/embed.js
```

**Expected Results:**
- Should return file content (not 404)
- Should include header: `Access-Control-Allow-Origin: *`

### Step 7: Check Page Source

**View Page Source:**
1. Right-click on page → View Page Source
2. Search for "crm-form" or "embed.js"

**Should See:**
```html
<!-- Form container -->
<div id="crm-form-xxxxx" class="crm-form-container" data-form-token="form_live_98Fh3ksd"></div>

<!-- Configuration script -->
<script>
window.CRM_SUPABASE_URL = "https://tgyetavhkukcclnwrroz.supabase.co";
window.CRM_SUPABASE_ANON_KEY = "eyJhbGci...";
window.CRM_DEBUG = false;
</script>

<!-- SDK files -->
<link rel='stylesheet' href='https://app.numbatrak.io/embed.css' />
<script src='https://app.numbatrak.io/embed.js'></script>
```

**If Missing:**
- No form container: Shortcode not processing (check syntax, plugin activated)
- No script tags: Settings not configured or enqueue failing
- No SDK files: URLs incorrect or enqueue failing

### Step 8: Test Supabase Connection

**Manual Test:**
```bash
curl -X GET "https://tgyetavhkukcclnwrroz.supabase.co/rest/v1/forms?form_token=eq.form_live_test123" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Replace `YOUR_ANON_KEY` with your actual anon key.

**Expected:** Should return JSON (even if empty array for invalid token)

### Step 9: Common Issues & Solutions

**Issue: Shortcode shows as text**
- **Cause**: Shortcode not registered
- **Fix**: 
  1. Deactivate and reactivate plugin
  2. Check for PHP errors
  3. Verify plugin file is correct

**Issue: "Settings saved" but values disappear**
- **Cause**: Database write issue or plugin conflict
- **Fix**:
  1. Check database connection
  2. Deactivate other plugins temporarily
  3. Check file permissions

**Issue: Form loads but shows "Error: Form not found"**
- **Cause**: Invalid form token or form not active
- **Fix**:
  1. Verify form token in Supabase database
  2. Check form `active` field is `true`
  3. Verify form belongs to correct organization

**Issue: Form container appears but nothing loads**
- **Cause**: JavaScript not executing or SDK not loading
- **Fix**:
  1. Check Console for JavaScript errors
  2. Verify SDK files are loading (Network tab)
  3. Check CORS headers
  4. Verify Supabase credentials

**Issue: CORS errors in console**
- **Cause**: Embed files not configured with CORS headers
- **Fix**:
  1. Verify `vercel.json` has CORS headers configured
  2. Redeploy to Vercel
  3. Test CORS headers: `curl -I https://app.numbatrak.io/embed.js`

### Step 10: Enable Debug Mode

**Enable WordPress Debug:**
Add to `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

**Enable SDK Debug:**
The plugin automatically enables debug if `WP_DEBUG` is true. Check browser console for `[CRM Form SDK]` messages.

**Check Debug Log:**
- Location: `wp-content/debug.log`
- Look for errors related to the plugin

### Still Not Working?

**Get More Information:**
1. Check browser console for exact error message
2. Check Network tab for failed requests
3. Check WordPress debug log
4. Verify all settings are correct
5. Test with a simple shortcode: `[crm_form form="test"]`

**Quick Test Checklist:**
- [ ] Plugin is activated
- [ ] Settings page accessible
- [ ] All 4 settings fields have values
- [ ] Settings saved successfully
- [ ] Shortcode syntax is correct: `[crm_form form="token"]`
- [ ] Page source shows form container div
- [ ] Page source shows SDK script tags
- [ ] Network tab shows embed.js loading (200 status)
- [ ] Network tab shows embed.css loading (200 status)
- [ ] Console shows no JavaScript errors
- [ ] Console shows Supabase API calls
- [ ] Form token is valid and form is active

- [ ] **Where to Insert the Shortcode**

  **Method 1: In a Post or Page (Classic Editor)**
  1. Go to WordPress Admin → Posts → Add New (or Pages → Add New)
  2. In the post/page editor, type or paste the shortcode:
     ```
     [crm_form form="form_live_98Fh3ksd"]
     ```
  3. Replace `form_live_98Fh3ksd` with your actual form token
  4. Publish or Update the post/page
  5. View the page - the form should appear where you placed the shortcode

  **Method 2: In a Post or Page (Gutenberg/Block Editor)**
  1. Go to WordPress Admin → Posts → Add New (or Pages → Add New)
  2. Click the "+" button to add a block
  3. Search for "Shortcode" block
  4. Click on the Shortcode block
  5. Paste your shortcode in the block:
     ```
     [crm_form form="form_live_98Fh3ksd"]
     ```
  6. Replace `form_live_98Fh3ksd` with your actual form token
  7. Publish or Update the post/page

  **Method 3: Using the CRM Form Block (Recommended)**
  1. Go to WordPress Admin → Posts → Add New (or Pages → Add New)
  2. Click the "+" button to add a block
  3. Search for "CRM Form" block
  4. Click on the CRM Form block
  5. Enter your form token in the block settings panel (right sidebar)
  6. The form will appear in the editor preview
  7. Publish or Update the post/page

  **Method 4: In a Widget**
  1. Go to WordPress Admin → Appearance → Widgets
  2. Add a "Shortcode" widget (or "Text" widget in older WordPress)
  3. Paste the shortcode:
     ```
     [crm_form form="form_live_98Fh3ksd"]
     ```
  4. Replace `form_live_98Fh3ksd` with your actual form token
  5. Save the widget
  6. The form will appear in the widget area (sidebar, footer, etc.)

  **Method 5: In a Theme Template (PHP)**
  1. Access your theme files via FTP or WordPress Admin → Appearance → Theme Editor
  2. Open the template file where you want the form (e.g., `page.php`, `single.php`, `footer.php`)
  3. Add the PHP code where you want the form to appear:
     ```php
     <?php echo do_shortcode('[crm_form form="form_live_98Fh3ksd"]'); ?>
     ```
  4. Replace `form_live_98Fh3ksd` with your actual form token
  5. Save the file
  6. The form will appear on all pages using that template

  **Method 6: In Elementor/Page Builder**
  1. Edit your page with Elementor (or other page builder)
  2. Add a "Shortcode" widget/element
  3. Paste the shortcode in the widget:
     ```
     [crm_form form="form_live_98Fh3ksd"]
     ```
  4. Replace `form_live_98Fh3ksd` with your actual form token
  5. Update the page

  **Method 7: In a Custom HTML Block**
  1. Add a "Custom HTML" block in Gutenberg
  2. Paste the shortcode:
     ```
     [crm_form form="form_live_98Fh3ksd"]
     ```
  3. Replace `form_live_98Fh3ksd` with your actual form token
  4. Publish or Update

  **Shortcode Syntax:**
  ```
  [crm_form form="YOUR_FORM_TOKEN"]
  ```
  
  Or using the `token` attribute (alternative):
  ```
  [crm_form token="YOUR_FORM_TOKEN"]
  ```
  
  Optional: Custom container ID
  ```
  [crm_form form="YOUR_FORM_TOKEN" id="my-custom-form"]
  ```

  **Where to Get Your Form Token:**
  - Log into your CRM dashboard
  - Navigate to Forms section
  - Find your form and copy the token (looks like: `form_live_98Fh3ksd`)
  - Paste it in the shortcode

  **Note**: You'll need to create a form in your CRM dashboard first (see Phase 5) to get a valid form token.

### Phase 5: Test Data (10 minutes)

- [ ] **Create Test Product**
  ```sql
  INSERT INTO products (organization_id, name, base_price, cost_price)
  VALUES ('your-org-id', 'Test Product', 100.00, 50.00);
  ```

- [ ] **Create Price History**
  ```sql
  INSERT INTO product_price_history (product_id, price, cost_price, starts_at)
  SELECT id, base_price, cost_price, NOW() FROM products WHERE name = 'Test Product';
  ```

- [ ] **Create Test Form**
  ```sql
  INSERT INTO forms (organization_id, name, form_token, schema, active)
  VALUES (
    'your-org-id',
    'Test Form',
    'form_live_test123',
    '{"fields": [{"id": "name", "type": "text", "label": "Name", "name": "customer_name", "required": true}], "submitButton": {"text": "Submit"}}'::jsonb,
    TRUE
  );
  ```

- [ ] **Attach Product to Form**
  ```sql
  INSERT INTO form_products (form_id, product_id, min_quantity, required)
  SELECT f.id, p.id, 1, TRUE
  FROM forms f, products p
  WHERE f.form_token = 'form_live_test123' AND p.name = 'Test Product';
  ```

### Phase 6: Testing (15 minutes)

- [ ] **Test Edge Function**
  ```bash
  curl -X POST https://tgyetavhkukcclnwrroz.supabase.co/functions/v1/create-order-from-form \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneWV0YXZoa3VrY2Nsbndycm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODEwNTMsImV4cCI6MjA4OTM1NzA1M30.g0ccRe2f3Mv7u5KLNpslUPMaT89_Y_OBG_SGuf8D4Bo" \
    -H "Content-Type: application/json" \
    -d '{"form_token": "form_live_test123", "customer_name": "Test", "items": [{"product_id": "xxx", "quantity": 1}]}'
  ```

- [ ] **Test Embed SDK**
  - Create test HTML file with form
  - Open in browser
  - Verify form loads
  - Submit form
  - Check order created

- [ ] **Test WordPress Plugin**
  - Create test page
  - Add shortcode: `[crm_form form="form_live_test123"]`
  - View page
  - Test submission

- [ ] **Test Abandoned Cart**
  - Fill form but don't submit
  - Wait 30 seconds
  - Check `abandoned_carts` table

## 🎯 Success Criteria

You're done when:

- ✅ All tables exist in Supabase
- ✅ RLS policies are active
- ✅ Edge Function is deployed
- ✅ Embed SDK files are accessible
- ✅ WordPress plugin is installed
- ✅ Test form submission works
- ✅ Order appears in database
- ✅ Abandoned cart tracking works

## 🚨 Common Issues

### "Table already exists"
- Drop old tables first (if safe)
- Or use `CREATE TABLE IF NOT EXISTS`

### "RLS policy error"
- Check helper functions exist
- Verify `is_org_member()` function works

### "Edge Function not found"
- Check function name matches
- Verify deployment succeeded
- Check project is linked

### "Embed SDK not loading"
- Check CORS headers
- Verify file URLs are correct
- Check browser console for errors

### "Form not submitting"
- Check Supabase URL and anon key
- Verify form token is correct
- Check Edge Function logs

## 📚 Need More Help?

- **Full Guide**: See `IMPLEMENTATION_GUIDE.md`
- **Database Schema**: See `DATABASE_MODELS_RESTRUCTURE.md`
- **RLS Policies**: See `scripts/RLS_POLICIES_GUIDE.md`
- **Edge Function**: See `supabase/functions/create-order-from-form/README.md`
- **Embed SDK**: See `scripts/embed-sdk-README.md`
- **WordPress Plugin**: See `scripts/wordpress-plugin/README.md`

## ⏱️ Estimated Time

- **Total**: ~1-2 hours (depending on experience)
- **Database Setup**: 15-30 minutes
- **Edge Function**: 10 minutes
- **SDK Hosting**: 10 minutes
- **WordPress Plugin**: 5 minutes
- **Testing**: 15-30 minutes

Good luck! 🚀
