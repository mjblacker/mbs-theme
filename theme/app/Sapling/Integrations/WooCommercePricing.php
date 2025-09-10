<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

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

        remove_action('woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10);
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