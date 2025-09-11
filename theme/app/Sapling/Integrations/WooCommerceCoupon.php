<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class WooCommerceCoupon implements SaplingPlugin
{
    public function init()
    {
        // Only initialize if WooCommerce is active
        if (!function_exists('WC')) {
            return;
        }

        add_action('wp_enqueue_scripts', array($this, 'enqueue_woocommerce_checkout_scripts'));
        
        // Override WooCommerce's default handlers with higher priority
        add_action('wc_ajax_apply_coupon', array($this, 'apply_coupon_handler'), 5);
        add_action('wp_ajax_woocommerce_apply_coupon', array($this, 'apply_coupon_handler'), 5);
        add_action('wp_ajax_nopriv_woocommerce_apply_coupon', array($this, 'apply_coupon_handler'), 5);
        add_action('wc_ajax_remove_coupon', array($this, 'remove_coupon_handler'), 5);
        add_action('wp_ajax_woocommerce_remove_coupon', array($this, 'remove_coupon_handler'), 5);
        add_action('wp_ajax_nopriv_woocommerce_remove_coupon', array($this, 'remove_coupon_handler'), 5);
        
        // Remove WooCommerce's default handlers to prevent conflicts
        add_action('init', array($this, 'remove_default_wc_handlers'), 20);
    }

    public function enqueue_woocommerce_checkout_scripts()
    {
        // Only load on checkout and cart pages and if WooCommerce is active
        if (!function_exists('WC') || (!is_checkout() && !is_cart())) {
            return;
        }

        // Check if the main script is enqueued before localizing
        if (!wp_script_is('main', 'enqueued')) {
            return;
        }

        // Ensure WooCommerce checkout parameters are available for our custom coupon functionality
        wp_localize_script('main', 'wc_checkout_params', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'wc_ajax_url' => WC_AJAX::get_endpoint('%%endpoint%%'),
            'update_order_review_nonce' => wp_create_nonce('update-order-review'),
            'apply_coupon_nonce' => wp_create_nonce('apply-coupon'),
            'remove_coupon_nonce' => wp_create_nonce('remove-coupon'),
            'checkout_url' => wc_get_checkout_url(),
            'is_checkout' => is_checkout() ? 1 : 0,
            'is_cart' => is_cart() ? 1 : 0,
            'debug_mode' => defined('WP_DEBUG') && WP_DEBUG,
            'i18n_checkout_error' => esc_attr__('Error processing checkout. Please try again.', 'woocommerce'),
        ));
    }

    public function apply_coupon_handler()
    {
        // Check if this is a valid request
        if (!isset($_POST['coupon_code'])) {
            wp_send_json_error('No coupon code provided');
            return;
        }

        $coupon_code = sanitize_text_field($_POST['coupon_code']);
        
        // Ensure we have a cart
        if (!WC()->cart) {
            wp_send_json_error('Cart not available');
            return;
        }

        // Check if coupon is already applied
        $applied_coupons = WC()->cart->get_applied_coupons();
        
        if (in_array($coupon_code, $applied_coupons)) {
            wp_send_json_error('Coupon is already applied');
            return;
        }

        // Try to apply the coupon
        $applied = WC()->cart->apply_coupon($coupon_code);
        
        if ($applied) {
            // Recalculate totals
            WC()->cart->calculate_totals();
            wp_send_json_success('Coupon applied successfully');
        } else {
            // Get the last WooCommerce notice for more specific error
            $notices = wc_get_notices('error');
            if (!empty($notices)) {
                $last_notice = end($notices);
                $error_message = is_array($last_notice) ? $last_notice['notice'] : $last_notice;
                // Clear the notice since we're handling it
                wc_clear_notices();
                wp_send_json_error($error_message);
            } else {
                wp_send_json_error('Invalid coupon code');
            }
        }
    }

    public function remove_coupon_handler()
    {
        // Check if this is a valid request
        if (!isset($_POST['coupon_code'])) {
            wp_send_json_error('No coupon code provided');
            return;
        }

        $coupon_code = sanitize_text_field($_POST['coupon_code']);
        
        // Ensure we have a cart
        if (!WC()->cart) {
            wp_send_json_error('Cart not available');
            return;
        }

        // Get applied coupons
        $applied_coupons = WC()->cart->get_applied_coupons();
        
        // Check if coupon is applied
        if (!in_array($coupon_code, $applied_coupons)) {
            // Coupon not applied, but return success anyway
            wp_send_json_success('Coupon was not applied');
            return;
        }

        // Try to remove the coupon
        $removed = WC()->cart->remove_coupon($coupon_code);
        
        if ($removed) {
            // Recalculate totals
            WC()->cart->calculate_totals();
            wp_send_json_success('Coupon removed successfully');
        } else {
            wp_send_json_error('Failed to remove coupon');
        }
    }

    public function remove_default_wc_handlers()
    {
        // Remove WooCommerce's default AJAX handlers to prevent conflicts
        if (class_exists('WC_AJAX')) {
            remove_action('wc_ajax_apply_coupon', array('WC_AJAX', 'apply_coupon'));
            remove_action('wp_ajax_woocommerce_apply_coupon', array('WC_AJAX', 'apply_coupon'));
            remove_action('wp_ajax_nopriv_woocommerce_apply_coupon', array('WC_AJAX', 'apply_coupon'));
            remove_action('wc_ajax_remove_coupon', array('WC_AJAX', 'remove_coupon'));
            remove_action('wp_ajax_woocommerce_remove_coupon', array('WC_AJAX', 'remove_coupon'));
            remove_action('wp_ajax_nopriv_woocommerce_remove_coupon', array('WC_AJAX', 'remove_coupon'));
        }
    }
}