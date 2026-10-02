<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;
use Automattic\WooCommerce\StoreApi\Schemas\V1\CartSchema;
use Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema;

class WooCommercePricing implements SaplingPlugin
{
    public function init()
    {
        // Only initialize if WooCommerce is active
        if (!function_exists('WC') || !function_exists('wc_get_product')) {
            return;
        }

        // Hook into cart item addition to ensure sale prices are used
        // 1. woocommerce_add_cart_item_data - Preserves sale price data when adding items to cart
        // 2. woocommerce_add_to_cart - Forces cart to use correct sale price after item is added
        // 3. woocommerce_add_cart_item - Applies sale price to the cart item when it's processed
        
        add_filter('woocommerce_add_cart_item_data', array($this, 'ensure_sale_price_in_cart'), 10, 3);
        add_action('woocommerce_add_to_cart', array($this, 'fix_cart_item_prices'), 10, 6);
        add_filter('woocommerce_add_cart_item', array($this, 'apply_sale_price_to_cart_item'), 10, 2);
        // Register extension schemas before WooCommerce registers its REST routes.
        add_action('rest_api_init', array($this, 'register_cart_drawer_data'), 5);

        remove_action('woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10);
    }

    /**
     * Expose core-formatted subtotals to the cart drawer through the Store API.
     */
    public function register_cart_drawer_data()
    {
        if (!function_exists('woocommerce_store_api_register_endpoint_data')) {
            return;
        }

        foreach (array(
            CartSchema::IDENTIFIER => 'get_cart_drawer_data',
            CartItemSchema::IDENTIFIER => 'get_cart_drawer_item_data',
        ) as $endpoint => $callback) {
            woocommerce_store_api_register_endpoint_data(array(
                'endpoint' => $endpoint,
                'namespace' => 'mbs_cart_drawer',
                'data_callback' => array($this, $callback),
                'schema_callback' => array($this, 'get_cart_drawer_schema'),
                'schema_type' => ARRAY_A,
            ));
        }
    }

    public function get_cart_drawer_schema()
    {
        return array(
            'subtotal_html' => array(
                'description' => 'Subtotal formatted using WooCommerce cart tax display settings.',
                'type' => 'string',
                'context' => array('view', 'edit'),
                'readonly' => true,
            ),
        );
    }

    public function get_cart_drawer_data()
    {
        return array(
            'subtotal_html' => WC()->cart ? wp_kses_post(WC()->cart->get_cart_subtotal()) : '',
        );
    }

    public function get_cart_drawer_item_data($cart_item)
    {
        $subtotal = '';

        if (WC()->cart && isset($cart_item['data'], $cart_item['quantity'], $cart_item['key'])) {
            // Use the same helper and filter as the standard cart and checkout rows.
            $subtotal = apply_filters(
                'woocommerce_cart_item_subtotal',
                WC()->cart->get_product_subtotal($cart_item['data'], $cart_item['quantity']),
                $cart_item,
                $cart_item['key']
            );
        }

        return array('subtotal_html' => wp_kses_post($subtotal));
    }

    /**
     * Ensure sale price data is preserved when adding to cart
     */
    public function ensure_sale_price_in_cart($cart_item_data, $product_id, $variation_id)
    {
        $product = wc_get_product($variation_id ? $variation_id : $product_id);
        
        if ($product && $product->is_on_sale()) {
            $cart_item_data['sale_price'] = $product->get_sale_price();
            $cart_item_data['regular_price'] = $product->get_regular_price();
            $cart_item_data['is_on_sale'] = true;
        }

        return $cart_item_data;
    }

    /**
     * Fix cart item prices after adding to cart
     */
    public function fix_cart_item_prices($cart_item_key, $product_id, $quantity, $variation_id, $variation, $cart_item_data)
    {
        $cart = WC()->cart;
        if (!$cart) {
            return;
        }

        $cart_contents = $cart->get_cart();
        if (!isset($cart_contents[$cart_item_key])) {
            return;
        }

        $product = wc_get_product($variation_id ? $variation_id : $product_id);
        if (!$product) {
            return;
        }

        // Force the cart to use the correct sale price
        if ($product->is_on_sale()) {
            $sale_price = $product->get_sale_price();
            if ($sale_price !== '') {
                $cart_contents[$cart_item_key]['data']->set_price($sale_price);
                $cart->set_cart_contents($cart_contents);
            }
        }
    }

    /**
     * Apply sale price to cart item when it's added
     */
    public function apply_sale_price_to_cart_item($cart_item, $cart_item_key)
    {
        $product = $cart_item['data'];
        
        if ($product && $product->is_on_sale()) {
            $sale_price = $product->get_sale_price();
            if ($sale_price !== '') {
                // Set the product price to the sale price
                $product->set_price($sale_price);
            }
        }

        return $cart_item;
    }
}
