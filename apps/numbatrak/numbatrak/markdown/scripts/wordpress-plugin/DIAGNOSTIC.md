# WordPress Plugin Diagnostic Tool

If the plugin isn't working, add this diagnostic code to help identify the issue.

## Quick Diagnostic

Add this shortcode to a test page to check plugin status:

```
[crm_form_diagnostic]
```

**Note**: This requires adding a diagnostic function to the plugin. See below.

## Manual Diagnostic Steps

### 1. Check Plugin Status

Add this to a test page template or use a plugin like "Code Snippets":

```php
<?php
// Check if plugin is active
if (class_exists('CRM_Form_Embed')) {
    echo '<p style="color: green;">✅ Plugin class exists</p>';
} else {
    echo '<p style="color: red;">❌ Plugin class NOT found</p>';
}

// Check if shortcode is registered
if (shortcode_exists('crm_form')) {
    echo '<p style="color: green;">✅ Shortcode registered</p>';
} else {
    echo '<p style="color: red;">❌ Shortcode NOT registered</p>';
}

// Check settings
$settings = get_option('crm_form_embed_settings', array());
if (empty($settings)) {
    echo '<p style="color: red;">❌ Settings not found</p>';
} else {
    echo '<p style="color: green;">✅ Settings found</p>';
    echo '<pre>';
    echo 'Supabase URL: ' . (isset($settings['supabase_url']) ? $settings['supabase_url'] : 'MISSING') . "\n";
    echo 'Supabase Key: ' . (isset($settings['supabase_anon_key']) ? (strlen($settings['supabase_anon_key']) > 0 ? 'SET (' . strlen($settings['supabase_anon_key']) . ' chars)' : 'EMPTY') : 'MISSING') . "\n";
    echo 'Embed JS URL: ' . (isset($settings['embed_js_url']) ? $settings['embed_js_url'] : 'MISSING') . "\n";
    echo 'Embed CSS URL: ' . (isset($settings['embed_css_url']) ? $settings['embed_css_url'] : 'MISSING') . "\n";
    echo '</pre>';
}
?>
```

### 2. Test Shortcode Output

Add this to see what the shortcode generates:

```php
<?php
echo do_shortcode('[crm_form form="test"]');
?>
```

You should see:
- A div with `id="crm-form-xxxxx"`
- A div with `data-form-token="test"`
- Script tags with Supabase configuration
- Link and script tags for embed.js and embed.css

### 3. Check Script Enqueue

Add this to check if scripts are being enqueued:

```php
<?php
global $wp_scripts, $wp_styles;

echo '<h3>Enqueued Scripts:</h3>';
echo '<pre>';
foreach ($wp_scripts->queue as $handle) {
    $script = $wp_scripts->registered[$handle];
    if (strpos($script->src, 'embed') !== false || strpos($script->src, 'crm') !== false) {
        echo $handle . ' => ' . $script->src . "\n";
    }
}
echo '</pre>';

echo '<h3>Enqueued Styles:</h3>';
echo '<pre>';
foreach ($wp_styles->queue as $handle) {
    $style = $wp_styles->registered[$handle];
    if (strpos($style->src, 'embed') !== false || strpos($style->src, 'crm') !== false) {
        echo $handle . ' => ' . $style->src . "\n";
    }
}
echo '</pre>';
?>
```

## Common Issues Checklist

Run through this checklist:

- [ ] Plugin is activated in WordPress Admin → Plugins
- [ ] Settings page is accessible: Settings → CRM Form Embed
- [ ] All 4 settings fields have values:
  - [ ] Supabase URL is set
  - [ ] Supabase Anon Key is set (not empty)
  - [ ] Embed JS URL is set
  - [ ] Embed CSS URL is set
- [ ] Settings were saved (clicked "Save Changes")
- [ ] Shortcode syntax is correct: `[crm_form form="token"]` (underscore, not hyphen)
- [ ] Form token is valid (exists in database and is active)
- [ ] Browser console shows no JavaScript errors
- [ ] Network tab shows embed.js loading (status 200)
- [ ] Network tab shows embed.css loading (status 200)
- [ ] Network tab shows Supabase API calls
- [ ] CORS headers are present on embed files

## Browser Console Commands

Open browser console (F12) and run these to check configuration:

```javascript
// Check if SDK is loaded
typeof window.CRM_SUPABASE_URL !== 'undefined'
// Should return: true

// Check Supabase URL
window.CRM_SUPABASE_URL
// Should return: "https://tgyetavhkukcclnwrroz.supabase.co"

// Check Supabase Key
window.CRM_SUPABASE_ANON_KEY
// Should return: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Check if SDK initialized
document.querySelectorAll('[data-form-token]')
// Should return: NodeList with form containers

// Check for form containers
document.querySelectorAll('.crm-form-container')
// Should return: NodeList with form containers
```

## Network Tab Checklist

In DevTools → Network tab, you should see:

1. **embed.js**
   - Status: 200
   - Type: script
   - Size: ~22KB
   - Headers include: `Access-Control-Allow-Origin: *`

2. **embed.css**
   - Status: 200
   - Type: stylesheet
   - Size: ~4KB
   - Headers include: `Access-Control-Allow-Origin: *`

3. **Supabase API calls**
   - URL pattern: `https://tgyetavhkukcclnwrroz.supabase.co/rest/v1/forms?...`
   - Status: 200 (or 404 if form not found)
   - Request headers include: `apikey` and `Authorization`

## Still Need Help?

If you've gone through all these steps and it's still not working:

1. **Collect Information:**
   - Screenshot of browser console errors
   - Screenshot of Network tab (failed requests)
   - Screenshot of Settings page
   - WordPress version
   - PHP version
   - List of active plugins

2. **Check WordPress Debug Log:**
   - Location: `wp-content/debug.log`
   - Look for errors related to "CRM Form Embed"

3. **Test in Clean Environment:**
   - Deactivate all other plugins
   - Switch to default WordPress theme
   - Test if plugin works
   - If it works, reactivate plugins one by one to find conflict
