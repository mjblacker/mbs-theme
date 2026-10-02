<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class ProductSearch implements SaplingPlugin
{
    private $taxonomy_matches = array();

    public function init()
    {
        if (!function_exists('WC')) {
            return;
        }

        add_filter('woocommerce_template_loader_files', array($this, 'search_template'));
        add_filter('woocommerce_redirect_single_search_result', array($this, 'keep_results_page'));
        add_action('woocommerce_product_query', array($this, 'published_products_only'));
        add_filter('posts_search', array($this, 'search_products'), 10, 2);
        add_filter('posts_search_orderby', array($this, 'rank_results'), 10, 2);
    }

    public function search_template($templates)
    {
        // WooCommerce otherwise routes product searches to the AJAX shop archive.
        if (is_search() && get_query_var('post_type') === 'product') {
            array_unshift($templates, 'search.php');
        }

        return $templates;
    }

    public function keep_results_page($redirect)
    {
        if (is_search() && get_query_var('post_type') === 'product') {
            return false;
        }

        return $redirect;
    }

    public function published_products_only($query)
    {
        if ($query->is_search() && $query->get('post_type') === 'product') {
            // Use WooCommerce's native search visibility and pagination rules.
            $query->set('post_status', 'publish');
        }
    }

    private function is_product_search($query)
    {
        return !is_admin() && $query->is_main_query() && $query->is_search()
            && $query->get('post_type') === 'product'
            && !$query->get('exact') && !$query->get('sentence');
    }

    public function search_products($search, $query)
    {
        if (!$this->is_product_search($query) || !$search) {
            return $search;
        }

        global $wpdb;

        $default_columns = array('post_title', 'post_excerpt', 'post_content');
        $columns = $query->get('search_columns') ?: $default_columns;
        $columns = (array) apply_filters('post_search_columns', (array) $columns, $query->get('s'), $query);
        $columns = array_intersect($columns, $default_columns) ?: $default_columns;

        // Use WordPress's parsed terms, preserving phrases, stopwords and exclusions.
        preg_match_all('/"([^"]*)(?:"|$)/', $query->get('s'), $quoted);
        $quoted_terms = array_map('trim', $quoted[1]);
        $exclusion_prefix = apply_filters('wp_query_search_exclusion_prefix', '-');
        $conditions = array();
        $positive_matches = array();

        foreach ((array) $query->get('search_terms') as $term) {
            $excluded = $exclusion_prefix && str_starts_with($term, $exclusion_prefix);
            if ($excluded) {
                $term = substr($term, strlen($exclusion_prefix));
            }
            $variants = array($term);
            if (!$excluded && !in_array($term, $quoted_terms, true) && preg_match('/^[a-z]+$/i', $term)) {
                $singular = $this->singular_form($term);
                if ($singular !== strtolower($term)) {
                    $variants[] = $singular;
                }
            }

            $matches = array();
            foreach ($default_columns as $column) {
                $matches[$column] = in_array($column, $columns, true)
                    ? $this->like_match("{$wpdb->posts}.{$column}", $variants)
                    : '0=1';
            }
            $matches['sku'] = $this->sku_match($variants);
            $matches['taxonomy'] = $this->taxonomy_match($variants);
            $all_fields = '(' . implode(' OR ', $matches) . ')';
            $conditions[] = $excluded ? "NOT {$all_fields}" : $all_fields;
            if (!$excluded) {
                $positive_matches[] = $matches;
            }
        }

        if (!$conditions) {
            return $search;
        }

        // Each word can match a different field (e.g. brand + product title), but
        // every positive word must match. EXISTS prevents duplicate product rows.
        $search = ' AND (' . implode(' AND ', $conditions) . ') ';
        if (!is_user_logged_in()) {
            $search .= " AND ({$wpdb->posts}.post_password = '') ";
        }

        $query->set('mbs_search_matches', $positive_matches);
        $query->set('search_orderby_title', array_column($positive_matches, 'post_title'));

        return $search;
    }

    private function like_match($column, $variants, $exact = false)
    {
        global $wpdb;

        $matches = array();
        foreach ($variants as $variant) {
            $matches[] = $exact
                ? $wpdb->prepare("{$column} = %s", $variant)
                : $wpdb->prepare("{$column} LIKE %s", '%' . $wpdb->esc_like($variant) . '%');
        }

        return '(' . implode(' OR ', $matches) . ')';
    }

    private function sku_match($variants, $exact = false)
    {
        global $wpdb;

        $lookup = $wpdb->prefix . 'wc_product_meta_lookup';
        $product_sku = $this->like_match('mbs_sku.sku', $variants, $exact);
        $variation_sku = $this->like_match('mbs_variation_sku.sku', $variants, $exact);
        $stock_condition = get_option('woocommerce_hide_out_of_stock_items') === 'yes'
            ? " AND mbs_variation_sku.stock_status <> 'outofstock'"
            : '';

        return "(EXISTS (SELECT 1 FROM {$lookup} AS mbs_sku
            WHERE mbs_sku.product_id = {$wpdb->posts}.ID AND {$product_sku})
            OR EXISTS (SELECT 1 FROM {$wpdb->posts} AS mbs_variation
                INNER JOIN {$lookup} AS mbs_variation_sku ON mbs_variation_sku.product_id = mbs_variation.ID
                WHERE mbs_variation.post_parent = {$wpdb->posts}.ID
                    AND mbs_variation.post_type = 'product_variation'
                    AND mbs_variation.post_status = 'publish'
                    {$stock_condition} AND {$variation_sku}))";
    }

    private function taxonomy_match($variants)
    {
        global $wpdb;

        $cache_key = serialize($variants);
        if (isset($this->taxonomy_matches[$cache_key])) {
            return $this->taxonomy_matches[$cache_key];
        }

        $taxonomies = array_filter(array('product_cat', 'product_brand'), 'taxonomy_exists');
        $taxonomy_ids = array();
        $child_ids = array();
        foreach ($variants as $variant) {
            $terms = get_terms(array(
                'taxonomy' => $taxonomies,
                'hide_empty' => false,
                'search' => $variant,
            ));
            if (is_wp_error($terms)) {
                continue;
            }
            foreach ($terms as $term) {
                $taxonomy_ids[] = $term->term_taxonomy_id;
                if ($term->taxonomy === 'product_cat') {
                    $children = get_term_children($term->term_id, 'product_cat');
                    if (!is_wp_error($children)) {
                        $child_ids = array_merge($child_ids, $children);
                    }
                }
            }
        }

        // A parent category search also finds products assigned to its children.
        if ($child_ids) {
            $children = get_terms(array(
                'taxonomy' => 'product_cat',
                'hide_empty' => false,
                'include' => array_unique($child_ids),
                'fields' => 'tt_ids',
            ));
            if (!is_wp_error($children)) {
                $taxonomy_ids = array_merge($taxonomy_ids, $children);
            }
        }

        $taxonomy_ids = array_unique(array_map('intval', $taxonomy_ids));
        $match = $taxonomy_ids
            ? "EXISTS (SELECT 1 FROM {$wpdb->term_relationships} AS mbs_search_term
                WHERE mbs_search_term.object_id = {$wpdb->posts}.ID
                    AND mbs_search_term.term_taxonomy_id IN (" . implode(',', $taxonomy_ids) . '))'
            : '0=1';
        $this->taxonomy_matches[$cache_key] = $match;

        return $match;
    }

    public function rank_results($orderby, $query)
    {
        if (!$this->is_product_search($query)
            || ($query->get('orderby') && $query->get('orderby') !== 'relevance')) {
            return $orderby;
        }

        global $wpdb;

        $matches = $query->get('mbs_search_matches');
        if (!is_array($matches)) {
            return $orderby;
        }
        if (!$matches) {
            return "{$wpdb->posts}.post_title ASC, {$wpdb->posts}.ID ASC";
        }

        $phrase = trim($query->get('s'));
        if (preg_match('/^"([^"]+)"$/', $phrase, $quoted)) {
            $phrase = $quoted[1];
        }
        $exact_sku = $this->sku_match(array($phrase), true);
        $exact_title = $wpdb->prepare("{$wpdb->posts}.post_title = %s", $phrase);
        $phrase_title = $this->like_match("{$wpdb->posts}.post_title", array($phrase));
        $all_title = '(' . implode(' AND ', array_column($matches, 'post_title')) . ')';
        $any_title = '(' . implode(' OR ', array_column($matches, 'post_title')) . ')';
        $any_sku = '(' . implode(' OR ', array_column($matches, 'sku')) . ')';
        $any_taxonomy = '(' . implode(' OR ', array_column($matches, 'taxonomy')) . ')';
        $any_excerpt = '(' . implode(' OR ', array_column($matches, 'post_excerpt')) . ')';

        $scores = array();
        foreach ($matches as $term_matches) {
            foreach (array('post_title' => 100, 'sku' => 80, 'taxonomy' => 40, 'post_excerpt' => 10, 'post_content' => 5) as $field => $weight) {
                $scores[] = "CASE WHEN {$term_matches[$field]} THEN {$weight} ELSE 0 END";
            }
        }

        // Fixed priority tiers keep description matches below title/taxonomy
        // matches. Weighted scores resolve mixed-field matches within each tier.
        return "CASE
            WHEN {$exact_sku} THEN 0
            WHEN {$exact_title} THEN 1
            WHEN {$phrase_title} THEN 2
            WHEN {$all_title} THEN 3
            WHEN {$any_title} THEN 4
            WHEN {$any_sku} THEN 5
            WHEN {$any_taxonomy} THEN 6
            WHEN {$any_excerpt} THEN 7
            ELSE 8 END ASC, (" . implode(' + ', $scores) . ") DESC,
            {$wpdb->posts}.post_title ASC, {$wpdb->posts}.ID ASC";
    }

    private function singular_form($word)
    {
        $word = strtolower($word);

        // Avoid stripping meaningful endings from materials and technical words.
        if (strlen($word) < 4 || in_array($word, array(
            'asbestos', 'canvas', 'news', 'series', 'species', 'means',
        ), true) || preg_match('/(?:ss|us|is)$/', $word)) {
            return $word;
        }

        $irregular = array(
            'children' => 'child',
            'people' => 'person',
            'feet' => 'foot',
            'teeth' => 'tooth',
            'knives' => 'knife',
            'shelves' => 'shelf',
            'halves' => 'half',
            'leaves' => 'leaf',
            'lives' => 'life',
            'wives' => 'wife',
            'buses' => 'bus',
            'statuses' => 'status',
            'ties' => 'tie',
            'dies' => 'die',
            'pies' => 'pie',
            'lies' => 'lie',
            'movies' => 'movie',
            'cookies' => 'cookie',
        );

        if (isset($irregular[$word])) {
            return $irregular[$word];
        }
        if (str_ends_with($word, 'ies')) {
            return substr($word, 0, -3) . 'y';
        }
        if (preg_match('/(?:ches|shes|sses|xes|zzes)$/', $word)) {
            return substr($word, 0, -2);
        }
        if (str_ends_with($word, 's')) {
            return substr($word, 0, -1);
        }

        return $word;
    }
}
