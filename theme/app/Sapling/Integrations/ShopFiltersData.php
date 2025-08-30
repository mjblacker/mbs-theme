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
        // Only add filter data on shop/archive pages
        if (is_shop() || is_product_category() || is_product_tag()) {
            $context['shop_filters'] = array(
                'categories' => $this->get_category_filter_data(),
                'brands' => $this->get_brand_filter_data()
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
     * @return array
     */
    private function get_brand_filter_data()
    {
        $brands = get_terms(array(
            'taxonomy' => 'product_brand',
            'hide_empty' => true
        ));

        if (!$brands || is_wp_error($brands)) {
            return array();
        }

        $brand_items = array();
        
        foreach ($brands as $brand) {
            $brand_items[] = array(
                'id' => $brand->term_id,
                'name' => $brand->name,
                'slug' => $brand->slug,
                'count' => $brand->count,
                'children' => array() // Brands don't have children
            );
        }

        return $brand_items;
    }
}