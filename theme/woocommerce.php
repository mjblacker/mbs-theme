<?php
/**
 * WooCommerce template
 *
 * @package WordPress
 * @subpackage Timberland
 * @since Timberland 2.2.0
 */

$context = Timber::context();

if ( is_singular( 'product' ) ) {
    $context['post'] = Timber::get_post();
    $product = wc_get_product( $context['post']->ID );
    $context['product'] = $product;

    Timber::render( 'woocommerce/single-product.twig', $context );
} else {
    $posts = Timber::get_posts();
    $context['posts'] = $posts;

    if ( is_product_category() || is_product_tag() || is_shop() ) {
        $queried_object = get_queried_object();
        $context['term'] = $queried_object;
        $context['title'] = single_term_title( '', false );
    }

    Timber::render( array( 'woocommerce/archive-product.twig', 'archive.twig' ), $context );
}