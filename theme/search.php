<?php
/**
 * @package WordPress
 * @subpackage Timberland
 * @since Timberland 2.2.0
 */

$templates = array( 'search.twig', 'archive.twig', 'index.twig' );

$context          = Timber::context();
$context['title'] = 'Search results for ' . get_search_query();
$context['posts'] = Timber::get_posts();
$context['search_query'] = get_search_query(false);

if (function_exists('wc_get_product') && get_query_var('post_type') === 'product') {
    global $wp_query;

    $templates = array('woocommerce/search-product.twig');
    $context['result_count'] = (int) $wp_query->found_posts;
    $context['shop_url'] = wc_get_page_permalink('shop');
    $context['search_sort_options'] = array(
        'relevance' => 'Relevance',
        'date-desc' => 'Latest',
        'date-asc' => 'Oldest',
        'price' => 'Price: Low to High',
        'price-desc' => 'Price: High to Low',
        'title' => 'Product Name: A–Z',
        'title-desc' => 'Product Name: Z–A',
    );

    // WooCommerce applies these native orderby values to the product search query.
    $sort = isset($_GET['orderby']) && is_string($_GET['orderby'])
        ? sanitize_text_field(wp_unslash($_GET['orderby']))
        : 'relevance';
    $context['search_sort'] = isset($context['search_sort_options'][$sort]) ? $sort : 'relevance';
}

Timber::render( $templates, $context );
