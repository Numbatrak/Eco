=== CRM Form Embed ===
Contributors: mail9ja
Tags: forms, crm, embed, supabase
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed dynamic CRM forms in WordPress using form tokens.

== Description ==

This plugin allows you to embed dynamic CRM forms in your WordPress site using simple shortcodes. Forms are fetched from your Supabase database and rendered dynamically.

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/crm-form-embed` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Go to Settings → CRM Form Embed to configure your Supabase credentials
4. Use the shortcode [crm_form form="YOUR_FORM_TOKEN"] in any post or page

== Frequently Asked Questions ==

= How do I get my form token? =

Log into your CRM dashboard, go to Forms, and copy the form token for the form you want to embed.

= Where do I get my Supabase credentials? =

Go to your Supabase dashboard → Settings → API. Copy the Project URL and anon/public key.

== Changelog ==

= 1.0.0 =
* Initial release
* Support for all form field types including radio groups
* Cache-busting for fresh form data
* Product name display in radio groups

== Upgrade Notice ==

= 1.0.0 =
Initial release. Install and configure your Supabase credentials.
