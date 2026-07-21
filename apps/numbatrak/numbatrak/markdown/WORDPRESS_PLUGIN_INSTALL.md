# WordPress Plugin Installation Guide

## 📦 Plugin File

The plugin file is located at:
```
scripts/wordpress-plugin/crm-form-embed.php
```

## 🚀 Installation Steps

### Step 1: Upload Plugin to WordPress

1. **Zip the plugin file:**
   - Create a folder named `crm-form-embed`
   - Copy `crm-form-embed.php` into that folder
   - Zip the folder (should be `crm-form-embed.zip`)

2. **Install via WordPress Admin:**
   - Go to WordPress Admin → Plugins → Add New
   - Click "Upload Plugin"
   - Choose the `crm-form-embed.zip` file
   - Click "Install Now"
   - Click "Activate Plugin"

### Step 2: Configure Settings

1. Go to **Settings → CRM Form Embed** in WordPress admin
2. Fill in the following:

   **Supabase Configuration:**
   - **Supabase URL:** `https://tgyetavhkukcclnwrroz.supabase.co`
   - **Supabase Anon Key:** (Get from your Supabase dashboard → Settings → API)

   **Embed SDK Configuration:**
   - **Embed JS URL:** `https://mail9ja.vercel.app/embed.js`
   - **Embed CSS URL:** `https://mail9ja.vercel.app/embed.css`

3. Click **"Save Settings"**

### Step 3: Use the Plugin

#### Option A: Shortcode
In any post, page, or widget, use:
```
[crm_form form="YOUR_FORM_TOKEN"]
```

Replace `YOUR_FORM_TOKEN` with your actual form token (e.g., `form_live_abc123`)

#### Option B: Gutenberg Block
1. Edit a page/post
2. Click the "+" to add a block
3. Search for "CRM Form"
4. Enter your form token

#### Option C: PHP (in theme templates)
```php
<?php echo do_shortcode('[crm_form form="YOUR_FORM_TOKEN"]'); ?>
```

## 🔍 Getting Your Form Token

1. Log into your CRM dashboard
2. Go to Forms section
3. Find your form
4. Copy the form token (looks like: `form_live_abc123`)

## ✅ Verification

After installation:
1. Create a test page with the shortcode
2. View the page
3. The form should load with all fields including radio groups
4. Check browser console (F12) for any errors

## 🐛 Troubleshooting

### Form Not Loading?
- Check browser console for errors
- Verify Supabase URL and Anon Key are correct
- Make sure form token is correct
- Check that form is "Active" in your CRM dashboard

### Radio Groups Not Showing?
- Clear WordPress cache (click "Purge Cache" in admin bar)
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Verify embed.js and embed.css URLs are correct in settings

### Styling Issues?
- Make sure embed.css URL is correct
- Check that CSS file is accessible (try opening URL in browser)
- Clear all caches (WordPress, browser, CDN)

## 📝 Notes

- The plugin automatically adds cache-busting parameters to prevent stale files
- Radio groups will display product names if products are configured
- All form field types are supported: text, email, phone, number, textarea, select, radio-group
