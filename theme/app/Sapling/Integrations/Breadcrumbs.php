<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class Breadcrumbs implements SaplingPlugin
{
    public function init()
    {
        add_filter('timber/context', array($this, 'add_breadcrumbs_to_context'));
    }

    public function add_breadcrumbs_to_context($context)
    {
        $context['breadcrumbs'] = $this->get_breadcrumbs();
        return $context;
    }

    /**
     * Build breadcrumb items array for WooCommerce pages
     * @return array
     */
    private function get_breadcrumbs()
    {
        $crumbs = array(
            array('label' => 'Home', 'url' => home_url(), 'current' => false)
        );

        if (!function_exists('is_cart') || !function_exists('wc_get_page_permalink')) {
            return $crumbs;
        }

        $shop_url = wc_get_page_permalink('shop');
        $cart_url = wc_get_cart_url();
        $checkout_url = wc_get_checkout_url();

        if (is_cart()) {
            $crumbs[] = array('label' => 'Cart', 'url' => null, 'current' => true);
        } elseif (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url('order-received')) {
            $crumbs[] = array('label' => 'Cart', 'url' => $cart_url, 'current' => false);
            $crumbs[] = array('label' => 'Checkout', 'url' => $checkout_url, 'current' => false);
            $crumbs[] = array('label' => 'Order Complete', 'url' => null, 'current' => true);
        } elseif (is_checkout()) {
            $crumbs[] = array('label' => 'Cart', 'url' => $cart_url, 'current' => false);
            $crumbs[] = array('label' => 'Checkout', 'url' => null, 'current' => true);
        } elseif (is_product()) {
            global $post;
            $crumbs[] = array('label' => 'All Products', 'url' => $shop_url, 'current' => false);
            $crumbs[] = array('label' => get_the_title($post->ID), 'url' => null, 'current' => true);
        } elseif (is_product_category()) {
            $crumbs[] = array('label' => 'All Products', 'url' => $shop_url, 'current' => false);
            $crumbs[] = array('label' => single_term_title('', false), 'url' => null, 'current' => true);
        } else {
            $crumbs[] = array('label' => 'All Products', 'url' => null, 'current' => true);
        }

        return $crumbs;
    }
}