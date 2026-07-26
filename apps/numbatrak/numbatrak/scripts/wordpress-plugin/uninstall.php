<?php
/**
 * Uninstall script for CRM Form Embed plugin
 * 
 * This file is executed when the plugin is deleted from WordPress
 */

// Exit if accessed directly
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Delete plugin options
delete_option('crm_form_embed_settings');

// Delete site options (multisite)
delete_site_option('crm_form_embed_settings');
