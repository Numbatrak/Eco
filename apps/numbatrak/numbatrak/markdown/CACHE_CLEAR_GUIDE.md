# Fix: Form Not Updating on Embedded Site

## Immediate Steps (Do These First!)

### 1. Clear WordPress Cache
In your WordPress admin bar (visible in the screenshot), click **"Purge Cache"** - this will clear any WordPress caching.

### 2. Clear Browser Cache
- **Chrome/Edge**: Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Select "Cached images and files"
- Click "Clear data"
- Or do a **Hard Refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### 3. Add Version Parameter to embed.js URL
If you're loading embed.js directly in your WordPress page, add a version parameter:

**Before:**
```html
<script src="https://app.numbatrak.io/embed.js"></script>
```

**After (add `?v=2` or current timestamp):**
```html
<script src="https://app.numbatrak.io/embed.js?v=2"></script>
```

### 4. Verify embed.js is Updated
Open browser console (F12) and check:
1. Go to Network tab
2. Reload the page
3. Find `embed.js` in the list
4. Click on it
5. Check the "Response" tab - it should have the cache-busting code we added

Look for this code in the response:
```javascript
const cacheBuster = `_t=${Date.now()}`;
```

If you don't see this, the file hasn't been deployed yet.

## Deployment Checklist

### ✅ Step 1: Verify Changes Are Committed
```bash
git log --oneline -1
# Should show: "Fix form saving and add cache-busting to embed SDK"
```

### ✅ Step 2: Push to Repository
```bash
git push origin custom_forms
# Or use your Git client to push
```

### ✅ Step 3: Wait for Vercel Deployment
1. Go to your Vercel dashboard
2. Check if deployment is in progress
3. Wait for it to complete (usually 1-2 minutes)

### ✅ Step 4: Verify Deployment
Test if the new embed.js is live:
```bash
curl https://app.numbatrak.io/embed.js | grep "cacheBuster"
```

Should return a line with `cacheBuster`.

## WordPress Plugin Update

If you're using the WordPress plugin:

1. **Update the plugin file** on your WordPress site:
   - Upload the updated `crm-form-embed.php` file
   - Or update via WordPress admin if you have it installed

2. **Or manually add version parameter**:
   In your WordPress page/post where you have the form, update the script tag:
   ```html
   <script src="https://app.numbatrak.io/embed.js?v=<?php echo time(); ?>"></script>
   ```

## Still Not Working?

### Check Form Token
Make sure you're using the correct form token:
1. Go to your CRM dashboard
2. Check the form token for the form you edited
3. Verify it matches what's in your WordPress page

### Enable Debug Mode
Add this before loading embed.js:
```html
<script>
  window.CRM_DEBUG = true;
</script>
<script src="https://app.numbatrak.io/embed.js?v=2"></script>
```

Then check browser console for debug messages.

### Check Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload page
4. Look for requests to Supabase:
   - Should see: `/rest/v1/forms?form_token=eq.YOUR_TOKEN&_t=...`
   - The `_t=` parameter is the cache-busting we added

## Quick Test

To test if it's a caching issue, try this in browser console:
```javascript
// Force reload embed.js
const script = document.createElement('script');
script.src = 'https://app.numbatrak.io/embed.js?v=' + Date.now();
document.head.appendChild(script);
```

Then reload the page and check if the form updates.
