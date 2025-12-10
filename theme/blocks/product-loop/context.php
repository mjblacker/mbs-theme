<?php
/**
 * Product Loop Block Context
 * Handles WooCommerce product data processing and validation
 */

// Ensure WooCommerce is active
if (!class_exists('WooCommerce')) {
    return [
        'products' => [],
        'error' => 'WooCommerce is not active. Please install and activate WooCommerce to use this block.'
    ];
}

// Get ACF fields
$selected_products = get_field('selected_products') ?: [];
$columns = get_field('columns') ?: '4';
$show_brand = get_field('show_brand') ?: false;
$show_sale_badge = get_field('show_sale_badge') ?: false;

$products = [];
$error = null;

// Process selected products
if (!empty($selected_products)) {
    foreach ($selected_products as $product_id) {
        // Get the product post
        $product_post = get_post($product_id);
        
        if ($product_post && $product_post->post_status === 'publish') {
            // Verify this is actually a product
            $wc_product = wc_get_product($product_id);
            
            if ($wc_product && $wc_product->is_purchasable()) {
                // Add Timber Post object for template compatibility
                $products[] = Timber\Timber::get_post($product_id);
            }
        }
    }
    
    if (empty($products) && !empty($selected_products)) {
        $error = 'No valid products found. Please ensure selected products are published and available.';
    }
} else {
    $error = 'No products selected. Please select products in the block settings.';
}

// Return context for Twig template
return [
    'products' => $products,
    'columns' => $columns,
    'show_brand' => $show_brand,
    'show_sale_badge' => $show_sale_badge,
    'error' => $error,
    'has_woocommerce' => class_exists('WooCommerce'),
    'selected_product_count' => count($selected_products),
    'valid_product_count' => count($products)
];