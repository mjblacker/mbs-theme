<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class ShopFiltersData implements SaplingPlugin
{
    public function init()
    {
        add_filter('timber/context', array($this, 'add_shop_filters_to_context'));
    }

    public function add_shop_filters_to_context($context)
    {
        // Only add filter data on shop/archive pages - check if WooCommerce functions exist first
        if (function_exists('is_shop') && (is_shop() || is_product_category() || is_product_tag())) {
            // Get current category context if on category page
            $current_category = null;
            if (is_product_category()) {
                $current_category = get_queried_object();
            }
            
            $context['shop_filters'] = array(
                'categories' => $this->get_category_filter_data(),
                'brands' => $this->get_brand_filter_data($current_category)
            );
        }

        return $context;
    }

    /**
     * Get formatted category data for filters
     * @return array
     */
    private function get_category_filter_data()
    {
        $categories = get_terms(array(
            'taxonomy' => 'product_cat',
            'hide_empty' => true,
            'hierarchical' => true,
            'parent' => 0
        ));

        if (!$categories || is_wp_error($categories)) {
            return array();
        }

        $category_items = array();
        
        foreach ($categories as $category) {
            // Get child categories
            $children = get_terms(array(
                'taxonomy' => 'product_cat',
                'hide_empty' => true,
                'parent' => $category->term_id
            ));

            $child_items = array();
            if ($children && !is_wp_error($children)) {
                foreach ($children as $child) {
                    $child_items[] = array(
                        'id' => $child->term_id,
                        'name' => $child->name,
                        'slug' => $child->slug,
                        'count' => $child->count
                    );
                }
            }

            $category_items[] = array(
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'count' => $category->count,
                'children' => $child_items
            );
        }

        return $category_items;
    }

    /**
     * Get formatted brand data for filters
     * @param WP_Term|null $current_category Current category context (if on category page)
     * @return array
     */
    private function get_brand_filter_data($current_category = null)
    {
        $brands = get_terms(array(
            'taxonomy' => 'product_brand',
            'hide_empty' => false // Get all brands, we'll filter manually
        ));

        if (!$brands || is_wp_error($brands)) {
            return array();
        }

        $brand_items = array();
        
        foreach ($brands as $brand) {
            // Manually count products for this brand, considering category context
            if ($current_category) {
                // On category page - count products in this brand AND current category
                $product_count = $this->get_product_count_with_category_context($brand->term_id, $current_category->term_id);
            } else {
                // On shop page - count all products for this brand
                $product_count = $this->get_product_count_for_term($brand->term_id, 'product_brand');
            }
            
            // Only include brands that have products
            if ($product_count > 0) {
                $brand_items[] = array(
                    'id' => $brand->term_id,
                    'name' => $brand->name,
                    'slug' => $brand->slug,
                    'count' => $product_count,
                    'children' => array() // Brands don't have children
                );
            }
        }

        return $brand_items;
    }

    /**
     * Manually count products for a specific term
     * @param int $term_id
     * @param string $taxonomy
     * @return int
     */
    private function get_product_count_for_term($term_id, $taxonomy)
    {
        $args = array(
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'tax_query' => array(
                array(
                    'taxonomy' => $taxonomy,
                    'field' => 'term_id',
                    'terms' => $term_id
                )
            )
        );

        $query = new \WP_Query($args);
        return $query->found_posts;
    }

    /**
     * Count products for a brand within a specific category context
     * @param int $brand_term_id
     * @param int $category_term_id
     * @return int
     */
    private function get_product_count_with_category_context($brand_term_id, $category_term_id)
    {
        $args = array(
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'tax_query' => array(
                'relation' => 'AND',
                array(
                    'taxonomy' => 'product_brand',
                    'field' => 'term_id',
                    'terms' => $brand_term_id
                ),
                array(
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => $category_term_id
                )
            )
        );

        $query = new \WP_Query($args);
        return $query->found_posts;
    }
}