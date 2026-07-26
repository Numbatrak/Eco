<?php
/**
 * Plugin Name: CRM Form Embed
 * Plugin URI: https://mail9ja.vercel.app
 * Description: Embed dynamic CRM forms in WordPress using form tokens. Minimal plugin that loads external SDK.
 * Version: 1.0.0
 * Author: Your Company
 * Author URI: https://mail9ja.vercel.app
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: crm-form-embed
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('CRM_FORM_EMBED_VERSION', '1.0.0');
define('CRM_FORM_EMBED_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CRM_FORM_EMBED_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main Plugin Class
 */
class CRM_Form_Embed {
    
    private static $instance = null;
    
    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        // Register activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Initialize plugin
        add_action('plugins_loaded', array($this, 'init'));
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Set default options
        $defaults = array(
            'api_base_url' => '',
            'embed_js_url' => 'https://mail9ja.vercel.app/embed.js',
            'embed_css_url' => 'https://mail9ja.vercel.app/embed.css',
        );
        
        if (!get_option('crm_form_embed_settings')) {
            add_option('crm_form_embed_settings', $defaults);
        }
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clean up if needed
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Register shortcode
        add_shortcode('crm_form', array($this, 'render_shortcode'));
        
        // Register Gutenberg block (optional)
        add_action('init', array($this, 'register_block'));
        
        // Admin settings
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        
        // Enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Add settings link to plugin page
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_settings_link'));
    }
    
    /**
     * Register shortcode
     */
    public function render_shortcode($atts) {
        // Parse shortcode attributes
        $atts = shortcode_atts(array(
            'form' => '',
            'token' => '', // Alias for 'form'
            'id' => 'crm-form-' . uniqid(), // Unique ID for multiple forms
        ), $atts, 'crm_form');
        
        // Get form token (support both 'form' and 'token' attributes)
        $form_token = !empty($atts['form']) ? $atts['form'] : $atts['token'];
        
        if (empty($form_token)) {
            return '<p style="color: red;">Error: Form token is required. Use [crm_form form="YOUR_TOKEN"]</p>';
        }
        
        // Get settings
        $settings = get_option('crm_form_embed_settings', array());
        
        // Check if SDK URLs are configured
        if (empty($settings['embed_js_url'])) {
            return '<p style="color: red;">Error: Embed SDK URL not configured. Please configure in Settings → CRM Form Embed</p>';
        }
        
        // Build container HTML
        $container_id = esc_attr($atts['id']);
        $form_token_attr = esc_attr($form_token);
        
        $html = sprintf(
            '<div id="%s" class="crm-form-container" data-form-token="%s"></div>',
            $container_id,
            $form_token_attr
        );
        
        // Add inline script to configure SDK
        $api_base_url = !empty($settings['api_base_url']) ? esc_js($settings['api_base_url']) : '';
        $debug = defined('WP_DEBUG') && WP_DEBUG ? 'true' : 'false';

        $html .= '<script>';
        $html .= 'if (typeof window.CRM_API_BASE_URL === "undefined") {';
        $html .= sprintf('window.CRM_API_BASE_URL = "%s";', $api_base_url);
        $html .= '}';
        $html .= sprintf('window.CRM_DEBUG = %s;', $debug);
        $html .= '</script>';
        
        // Add script tag with version parameter for cache-busting
        $embed_js_url = !empty($settings['embed_js_url']) ? esc_url($settings['embed_js_url']) : '';
        if ($embed_js_url) {
            $version = defined('CRM_FORM_EMBED_JS_VERSION') ? CRM_FORM_EMBED_JS_VERSION : time();
            $embed_js_url = add_query_arg('v', $version, $embed_js_url);
            $html .= sprintf('<script src="%s?v=%s" defer></script>', esc_url($embed_js_url), esc_attr($version));
        }
        
        return $html;
    }
    
    /**
     * Register Gutenberg block (optional)
     */
    public function register_block() {
        // Only register if Gutenberg is available
        if (!function_exists('register_block_type')) {
            return;
        }
        
        // Register block script
        wp_register_script(
            'crm-form-embed-block',
            CRM_FORM_EMBED_PLUGIN_URL . 'block.js',
            array('wp-blocks', 'wp-element', 'wp-editor', 'wp-components'),
            CRM_FORM_EMBED_VERSION,
            true
        );
        
        // Register block
        register_block_type('crm-form-embed/form', array(
            'editor_script' => 'crm-form-embed-block',
            'render_callback' => array($this, 'render_shortcode'),
            'attributes' => array(
                'formToken' => array(
                    'type' => 'string',
                    'default' => '',
                ),
            ),
        ));
    }
    
    /**
     * Enqueue scripts and styles
     */
    public function enqueue_scripts() {
        $settings = get_option('crm_form_embed_settings', array());
        
        // Enqueue CSS
        if (!empty($settings['embed_css_url'])) {
            // Add cache-busting version parameter
            $css_url = esc_url($settings['embed_css_url']);
            $version = defined('CRM_FORM_EMBED_CSS_VERSION') ? CRM_FORM_EMBED_CSS_VERSION : time(); // Use timestamp for cache-busting
            $css_url = add_query_arg('v', $version, $css_url);
            
            wp_enqueue_style(
                'crm-form-embed-css',
                $css_url,
                array(),
                $version
            );
        }
        
        // Enqueue JS (defer loading)
        if (!empty($settings['embed_js_url'])) {
            // Add cache-busting version parameter (timestamp or version)
            $js_url = esc_url($settings['embed_js_url']);
            $version = defined('CRM_FORM_EMBED_JS_VERSION') ? CRM_FORM_EMBED_JS_VERSION : time(); // Use timestamp for cache-busting
            $js_url = add_query_arg('v', $version, $js_url);
            
            wp_enqueue_script(
                'crm-form-embed-js',
                $js_url,
                array(),
                $version,
                true
            );
        }
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('CRM Form Embed Settings', 'crm-form-embed'),
            __('CRM Form Embed', 'crm-form-embed'),
            'manage_options',
            'crm-form-embed',
            array($this, 'render_settings_page')
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            'crm_form_embed_settings',
            'crm_form_embed_settings',
            array($this, 'sanitize_settings')
        );
        
        // API Settings Section
        add_settings_section(
            'crm_form_embed_api_section',
            __('API Configuration', 'crm-form-embed'),
            array($this, 'render_api_section'),
            'crm-form-embed'
        );

        add_settings_field(
            'api_base_url',
            __('API Base URL', 'crm-form-embed'),
            array($this, 'render_api_base_url_field'),
            'crm-form-embed',
            'crm_form_embed_api_section'
        );
        
        // SDK Settings Section
        add_settings_section(
            'crm_form_embed_sdk_section',
            __('Embed SDK Configuration', 'crm-form-embed'),
            array($this, 'render_sdk_section'),
            'crm-form-embed'
        );
        
        add_settings_field(
            'embed_js_url',
            __('Embed JS URL', 'crm-form-embed'),
            array($this, 'render_embed_js_url_field'),
            'crm-form-embed',
            'crm_form_embed_sdk_section'
        );
        
        add_settings_field(
            'embed_css_url',
            __('Embed CSS URL', 'crm-form-embed'),
            array($this, 'render_embed_css_url_field'),
            'crm-form-embed',
            'crm_form_embed_sdk_section'
        );
    }
    
    /**
     * Sanitize settings
     */
    public function sanitize_settings($input) {
        $sanitized = array();

        if (isset($input['api_base_url'])) {
            $sanitized['api_base_url'] = esc_url_raw($input['api_base_url']);
        }

        if (isset($input['embed_js_url'])) {
            $sanitized['embed_js_url'] = esc_url_raw($input['embed_js_url']);
        }
        
        if (isset($input['embed_css_url'])) {
            $sanitized['embed_css_url'] = esc_url_raw($input['embed_css_url']);
        }
        
        return $sanitized;
    }
    
    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        // Check if settings were saved
        if (isset($_GET['settings-updated'])) {
            add_settings_error(
                'crm_form_embed_messages',
                'crm_form_embed_message',
                __('Settings saved successfully.', 'crm-form-embed'),
                'updated'
            );
        }
        
        settings_errors('crm_form_embed_messages');
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <form action="options.php" method="post">
                <?php
                settings_fields('crm_form_embed_settings');
                do_settings_sections('crm-form-embed');
                submit_button(__('Save Settings', 'crm-form-embed'));
                ?>
            </form>
            
            <hr>
            
            <h2><?php _e('Usage', 'crm-form-embed'); ?></h2>
            <div class="card">
                <h3><?php _e('Shortcode', 'crm-form-embed'); ?></h3>
                <p><?php _e('Use the shortcode in any post, page, or widget:', 'crm-form-embed'); ?></p>
                <code>[crm_form form="form_live_98Fh3ksd"]</code>
                
                <h3 style="margin-top: 20px;"><?php _e('Gutenberg Block', 'crm-form-embed'); ?></h3>
                <p><?php _e('Search for "CRM Form" in the block inserter.', 'crm-form-embed'); ?></p>
                
                <h3 style="margin-top: 20px;"><?php _e('PHP', 'crm-form-embed'); ?></h3>
                <p><?php _e('Use in your theme templates:', 'crm-form-embed'); ?></p>
                <code>&lt;?php echo do_shortcode('[crm_form form="form_live_98Fh3ksd"]'); ?&gt;</code>
            </div>
            
            <h2 style="margin-top: 30px;"><?php _e('Getting Your Form Token', 'crm-form-embed'); ?></h2>
            <div class="card">
                <p><?php _e('Form tokens are generated in your CRM dashboard. Each form has a unique token that looks like:', 'crm-form-embed'); ?></p>
                <code>form_live_98Fh3ksd</code>
                <p style="margin-top: 10px;"><?php _e('Copy the token from your dashboard and paste it in the shortcode.', 'crm-form-embed'); ?></p>
            </div>
        </div>
        <?php
    }
    
    /**
     * Render API section
     */
    public function render_api_section() {
        echo '<p>' . __('Configure the base URL of your CRM API. This is used by the embed SDK to fetch form schemas and submit orders.', 'crm-form-embed') . '</p>';
    }
    
    /**
     * Render SDK section
     */
    public function render_sdk_section() {
        echo '<p>' . __('Configure the URLs for the embed SDK files. These should point to your hosted embed.js and embed.css files.', 'crm-form-embed') . '</p>';
    }
    
    /**
     * Render API Base URL field
     */
    public function render_api_base_url_field() {
        $settings = get_option('crm_form_embed_settings', array());
        $value = isset($settings['api_base_url']) ? $settings['api_base_url'] : '';
        ?>
        <input type="url"
               name="crm_form_embed_settings[api_base_url]"
               value="<?php echo esc_attr($value); ?>"
               class="regular-text"
               placeholder="https://api.yourcrm.com">
        <p class="description"><?php _e('The base URL of your CRM API (no trailing slash). The SDK calls /public/numbatrak/forms/{token} on this host.', 'crm-form-embed'); ?></p>
        <?php
    }
    
    /**
     * Render Embed JS URL field
     */
    public function render_embed_js_url_field() {
        $settings = get_option('crm_form_embed_settings', array());
        $value = isset($settings['embed_js_url']) ? $settings['embed_js_url'] : 'https://mail9ja.vercel.app/embed.js';
        ?>
        <input type="url" 
               name="crm_form_embed_settings[embed_js_url]" 
               value="<?php echo esc_attr($value); ?>" 
               class="regular-text"
               placeholder="https://mail9ja.vercel.app/embed.js">
        <p class="description"><?php _e('URL to your hosted embed.js file.', 'crm-form-embed'); ?></p>
        <?php
    }
    
    /**
     * Render Embed CSS URL field
     */
    public function render_embed_css_url_field() {
        $settings = get_option('crm_form_embed_settings', array());
        $value = isset($settings['embed_css_url']) ? $settings['embed_css_url'] : 'https://mail9ja.vercel.app/embed.css';
        ?>
        <input type="url" 
               name="crm_form_embed_settings[embed_css_url]" 
               value="<?php echo esc_attr($value); ?>" 
               class="regular-text"
               placeholder="https://mail9ja.vercel.app/embed.css">
        <p class="description"><?php _e('URL to your hosted embed.css file.', 'crm-form-embed'); ?></p>
        <?php
    }
    
    /**
     * Add settings link to plugin page
     */
    public function add_settings_link($links) {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            admin_url('options-general.php?page=crm-form-embed'),
            __('Settings', 'crm-form-embed')
        );
        array_unshift($links, $settings_link);
        return $links;
    }
}

// Initialize plugin
CRM_Form_Embed::get_instance();
