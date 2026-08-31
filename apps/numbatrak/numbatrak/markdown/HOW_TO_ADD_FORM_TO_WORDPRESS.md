# How to Add a Form to WordPress Site

## Quick Start Guide

### Method 1: Using the WordPress Plugin (Recommended)

#### Step 1: Install the Plugin

1. **Get the plugin file:**
   - Location: `/Users/macbookpro/Desktop/mail9ja/wordpress-plugin-ready/crm-form-embed.zip`
   - Or manually create: Put `crm-form-embed.php` in a folder named `crm-form-embed`, then zip it

2. **Install in WordPress:**
   - Log into your WordPress admin dashboard
   - Go to **Plugins → Add New**
   - Click **"Upload Plugin"** button at the top
   - Click **"Choose File"** and select `crm-form-embed.zip`
   - Click **"Install Now"**
   - After installation, click **"Activate Plugin"**

#### Step 2: Configure the Plugin

1. Go to **Settings → CRM Form Embed** in WordPress admin
2. Enter your configuration:

   **Supabase Settings:**
   - **Supabase URL:** `https://tgyetavhkukcclnwrroz.supabase.co`
   - **Supabase Anon Key:** 
     - Go to your Supabase Dashboard: https://supabase.com/dashboard
     - Select your project
     - Go to **Settings → API**
     - Copy the **"anon"** or **"public"** key
     - Paste it in the WordPress settings

   **Embed SDK Settings:**
   - **Embed JS URL:** `https://app.numbatrak.io/embed.js`
   - **Embed CSS URL:** `https://app.numbatrak.io/embed.css`

3. Click **"Save Settings"**

#### Step 3: Get Your Form Token

1. Log into your CRM dashboard (mail9ja app)
2. Navigate to **Forms** section
3. Find the form you want to embed
4. Copy the **Form Token** (looks like: `form_live_abc123`)

#### Step 4: Add Form to Your WordPress Page

**Option A: Using Shortcode (Easiest)**

1. Edit any WordPress page or post
2. In the content editor, simply type:
   ```
   [crm_form form="form_live_abc123"]
   ```
   Replace `form_live_abc123` with your actual form token

3. Publish or Update the page
4. View the page - your form should appear!

**Option B: Using Gutenberg Block**

1. Edit a page/post in WordPress
2. Click the **"+"** button to add a block
3. Search for **"CRM Form"** in the block search
4. Select the **"CRM Form"** block
5. Enter your form token in the block settings
6. Publish/Update the page

**Option C: Using Page Builders (Elementor, Thrive Architect, etc.)**

1. Edit your page with your page builder
2. Add a **"Shortcode"** widget/block
3. Paste: `[crm_form form="form_live_abc123"]`
4. Replace with your actual form token
5. Save and publish

**Option D: In Theme Template (PHP)**

If you want to add it directly in your theme files:

```php
<?php echo do_shortcode('[crm_form form="form_live_abc123"]'); ?>
```

---

### Method 2: Without Plugin (Manual Method)

If you prefer not to use the plugin, you can add the form directly:

#### Step 1: Add to Your Page/Post

In your WordPress page or post editor, add this HTML:

```html
<div id="crm-form" data-form-token="form_live_abc123"></div>

<script>
  window.CRM_SUPABASE_URL = 'https://tgyetavhkukcclnwrroz.supabase.co';
  window.CRM_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
  window.CRM_DEBUG = true; // Set to false in production
</script>
<link rel="stylesheet" href="https://app.numbatrak.io/embed.css">
<script src="https://app.numbatrak.io/embed.js"></script>
```

**Important:** Replace:
- `form_live_abc123` with your actual form token
- `YOUR_SUPABASE_ANON_KEY` with your Supabase anon key

#### Step 2: For Elementor/Page Builders

1. Add an **"HTML"** widget
2. Paste the code above
3. Replace the form token and Supabase key
4. Save

---

## Verification Checklist

After adding the form:

✅ **Check Browser Console (F12):**
   - Should see: `[CRM Form SDK] Version 2.0.0 loaded`
   - Should see: `✅ Radio Groups Support Enabled`
   - No red error messages

✅ **Check Form Display:**
   - Form fields appear correctly
   - Radio buttons are visible (if you have radio groups)
   - Submit button is visible

✅ **Test Form Submission:**
   - Fill out the form
   - Submit it
   - Check your CRM dashboard for the new order

---

## Troubleshooting

### Form Not Showing?

1. **Check Form Token:**
   - Make sure the token is correct
   - Token should start with `form_live_` or `form_test_`
   - No extra spaces or quotes

2. **Check Supabase Settings:**
   - Verify Supabase URL is correct
   - Verify Anon Key is correct (get from Supabase Dashboard → Settings → API)

3. **Check Browser Console:**
   - Open F12 → Console tab
   - Look for error messages
   - Check if embed.js is loading (Network tab)

4. **Clear Cache:**
   - WordPress: Click "Purge Cache" in admin bar
   - Browser: Hard refresh (`Ctrl+Shift+R` or `Cmd+Shift+R`)

### Radio Buttons Not Showing?

1. **Check Console Logs:**
   - Should see: "Rendering radio group: field_name with X options"
   - Should see: "Created radio button: {...}"

2. **Verify Form Schema:**
   - In your CRM dashboard, check that the form has radio-group fields
   - Make sure radio options are configured

3. **Check CSS:**
   - Verify embed.css URL is correct
   - Try opening `https://app.numbatrak.io/embed.css` in browser

### Form Loading But Fields Missing?

1. **Check Form is Active:**
   - In CRM dashboard, make sure form status is "Active"
   - Inactive forms won't load

2. **Check Form Schema:**
   - Verify the form has fields defined
   - Check that fields have proper types (text, email, radio-group, etc.)

---

## Example: Complete Setup

Here's a complete example for a WordPress page:

**In WordPress Page Editor:**
```
[crm_form form="form_live_test123"]
```

**Or in HTML/Code view:**
```html
<div id="crm-form" data-form-token="form_live_test123"></div>
```

**Plugin Settings:**
- Supabase URL: `https://tgyetavhkukcclnwrroz.supabase.co`
- Supabase Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your actual key)
- Embed JS URL: `https://app.numbatrak.io/embed.js`
- Embed CSS URL: `https://app.numbatrak.io/embed.css`

---

## Quick Reference

**Shortcode Format:**
```
[crm_form form="YOUR_FORM_TOKEN"]
```

**Multiple Forms on Same Page:**
```
[crm_form form="form_live_123" id="form-1"]
[crm_form form="form_live_456" id="form-2"]
```

**Get Form Token:**
1. CRM Dashboard → Forms
2. Click on your form
3. Copy the "Form Token" field

**Get Supabase Anon Key:**
1. Supabase Dashboard → Your Project
2. Settings → API
3. Copy "anon" or "public" key

---

## Need Help?

If the form still doesn't work:
1. Check browser console (F12) for errors
2. Verify all settings are correct
3. Make sure form is saved and active in CRM dashboard
4. Clear all caches (WordPress, browser, CDN)
