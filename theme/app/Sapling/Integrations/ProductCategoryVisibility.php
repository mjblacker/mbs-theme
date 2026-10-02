<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class ProductCategoryVisibility implements SaplingPlugin
{
    public function init()
    {
        add_filter('get_terms', array($this, 'hide_software_categories'), 10, 3);
    }

    /**
     * Hide Software from front-end category lists, including AJAX shop filters.
     */
    public function hide_software_categories($terms, $taxonomies, $args)
    {
        if ((is_admin() && !wp_doing_ajax()) || !is_array($terms)
            || !in_array('product_cat', (array) $taxonomies, true)
            || !in_array($args['fields'] ?? 'all', array('all', 'all_with_object_id'), true)) {
            return $terms;
        }

        return array_values(array_filter($terms, function ($term) {
            return !($term instanceof \WP_Term
                && $term->taxonomy === 'product_cat'
                && strcasecmp(trim($term->name), 'software') === 0);
        }));
    }
}
