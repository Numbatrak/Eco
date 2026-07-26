# CRM Form Embed - WordPress Plugin

Minimal WordPress plugin for embedding dynamic CRM forms using form tokens.

## Features

✅ **Shortcode Support** - `[crm_form form="TOKEN"]`  
✅ **Gutenberg Block** - Visual form inserter  
✅ **Admin Settings** - Configure Supabase credentials and SDK URLs  
✅ **External SDK Loading** - Loads embed.js and embed.css from your domain  
✅ **Minimal & Clean** - No database writes, no business logic, just embedding  
✅ **WordPress Standards** - Follows WordPress coding standards and best practices  

## Installation

### Option 1: Manual Installation

1. Upload the `crm-form-embed` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings → CRM Form Embed to configure

### Option 2: ZIP Installation

1. Create a ZIP file of the plugin folder
2. Go to Plugins → Add New → Upload Plugin
3. Upload the ZIP file
4. Activate and configure

## Configuration

### Step 1: Configure Settings

Go to **Settings → CRM Form Embed** and enter:

1. **Supabase URL**: Your Supabase project URL
   - Example: `https://tgyetavhkukcclnwrroz.supabase.co`
   - Found in Supabase Dashboard → Settings → API

2. **Supabase Anon Key**: Your public/anonymous key
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Found in Supabase Dashboard → Settings → API
   - Safe to use in client-side code

3. **Embed JS URL**: URL to your hosted `embed.js`
   - Example: `https://mail9ja.vercel.app/embed.js`

4. **Embed CSS URL**: URL to your hosted `embed.css`
   - Example: `https://mail9ja.vercel.app/embed.css`

### Step 2: Get Your Form Token

1. Log into your CRM dashboard
2. Navigate to Forms
3. Copy the form token (e.g., `form_live_98Fh3ksd`)

## Usage

### Shortcode

Use the shortcode in any post, page, or widget:

```
[crm_form form="form_live_98Fh3ksd"]
```

**Attributes:**
- `form` (required) - Form token
- `token` (alias) - Alternative to `form`
- `id` (optional) - Custom container ID (auto-generated if not provided)

**Examples:**
```
[crm_form form="form_live_98Fh3ksd"]
[crm_form token="form_live_abc123"]
[crm_form form="form_live_xyz789" id="my-custom-form"]
```

### Gutenberg Block

1. Add a new block
2. Search for "CRM Form"
3. Enter the form token in the block settings
4. Publish

### PHP Template

Use in your theme templates:

```php
<?php echo do_shortcode('[crm_form form="form_live_98Fh3ksd"]'); ?>
```

### Widget

Add to any widget area:
1. Go to Appearance → Widgets
2. Add a "Shortcode" widget
3. Enter: `[crm_form form="form_live_98Fh3ksd"]`

## Plugin Architecture

### What This Plugin DOES

✅ Registers shortcode `[crm_form]`  
✅ Provides admin settings page  
✅ Enqueues external embed.js and embed.css  
✅ Passes configuration to SDK via global variables  
✅ Registers Gutenberg block (optional)  

### What This Plugin DOES NOT

❌ Store orders  
❌ Calculate prices  
❌ Validate products  
❌ Talk to database directly  
❌ Handle business logic  

**This minimal approach ensures plugins survive WordPress chaos** 🌪️

## File Structure

```
wordpress-plugin/
├── crm-form-embed.php    # Main plugin file
├── block.js              # Gutenberg block (optional)
└── README.md             # This file
```

## Hooks & Filters

### Actions

- `crm_form_embed_before_render` - Before form container is rendered
- `crm_form_embed_after_render` - After form container is rendered

### Filters

- `crm_form_embed_container_attrs` - Modify container attributes
- `crm_form_embed_settings` - Modify settings before use

## Security

- ✅ All user input is sanitized
- ✅ Settings are validated and escaped
- ✅ No direct database access
- ✅ Uses WordPress Settings API
- ✅ Capability checks for admin pages

## Troubleshooting

### Form Not Loading

1. **Check Settings**: Verify Supabase URL and Anon Key are correct
2. **Check SDK URLs**: Verify embed.js and embed.css URLs are accessible
3. **Check Browser Console**: Look for JavaScript errors
4. **Check Form Token**: Verify token is correct and form is active

### Shortcode Not Working

1. **Check Syntax**: Ensure shortcode is `[crm_form form="TOKEN"]`
2. **Check Token**: Verify form token is correct
3. **Check Permissions**: Ensure user can view the page

### Gutenberg Block Not Showing

1. **Check Gutenberg**: Ensure you're using Gutenberg editor
2. **Check Block Registration**: Verify block.js is loading
3. **Clear Cache**: Clear browser and WordPress cache

## Development

### Requirements

- WordPress 5.0+
- PHP 7.4+
- Modern browser (for Gutenberg)

### Testing

1. Install plugin in test environment
2. Configure settings
3. Test shortcode in post/page
4. Test Gutenberg block
5. Verify form loads and submits correctly

## Support

For issues or questions:
- Check the embed SDK documentation: `scripts/embed-sdk-README.md`
- Check the Edge Function documentation: `supabase/functions/create-order-from-form/README.md`
- Review the main documentation: `DATABASE_MODELS_RESTRUCTURE.md`

## Changelog

### 1.0.0
- Initial release
- Shortcode support
- Gutenberg block
- Admin settings page
- External SDK loading

## License

GPL v2 or later

## Credits

Part of the CRM Form Embed system. See main project documentation for architecture details.
