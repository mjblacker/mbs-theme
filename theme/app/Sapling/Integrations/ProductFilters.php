<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class ProductFilters implements SaplingPlugin
{
    public function init()
    {
         // Only initialize if WooCommerce is active
        if (!function_exists('WC') || !function_exists('wc_get_product')) {
            return;
        }
        
        add_action('wp_ajax_filter_products', array($this, 'filter_products'));
        add_action('wp_ajax_nopriv_filter_products', array($this, 'filter_products'));
        add_action('wp_ajax_update_filter_counts', array($this, 'update_filter_counts_only'));
        add_action('wp_ajax_nopriv_update_filter_counts', array($this, 'update_filter_counts_only'));
        add_action('wp_enqueue_scripts', array($this, 'localize_filter_script'));
    }

    public function localize_filter_script()
    {
        // Localize script data for both shop/archive and single product pages
        $script_data = array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'cartApiUrl' => rest_url('wc/store/cart'),
            'cartUrl' => wc_get_cart_url(),
            'checkoutUrl' => wc_get_checkout_url(),
            'nonce' => wp_create_nonce('filter_products_nonce'),
            'storeApiNonce' => wp_create_nonce('wc_store_api')
        );

        // Try to localize to main script first (production)
        if (wp_script_is('main', 'enqueued')) {
            // For shop/archive pages
            if (is_shop() || is_product_category() || is_product_tag()) {
                wp_localize_script('main', 'shopFiltersAjax', $script_data);
            }
            // For single product pages and general use
            wp_localize_script('main', 'wpEndpoints', $script_data);
        } else {
            // Fallback: add to wp_head for development mode
            add_action('wp_head', function() use ($script_data) {
                echo '<script type="text/javascript">';
                // For shop/archive functionality
                if (is_shop() || is_product_category() || is_product_tag()) {
                    echo 'window.shopFiltersAjax = ' . json_encode($script_data) . ';';
                }
                // For single product and general functionality
                echo 'window.wpEndpoints = ' . json_encode($script_data) . ';';
                echo '</script>';
            }, 5);
        }
    }

    public function filter_products()
    {
        try {
            // Debug logging
            // error_log('ProductFilters: filter_products called');
            // error_log('POST data: ' . print_r($_POST, true));

            // Verify nonce
            if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'filter_products_nonce')) {
                error_log('ProductFilters: Nonce verification failed');
                wp_send_json_error('Security check failed');
                return;
            }

            // Get filter parameters
            $categories = isset($_POST['categories']) ? json_decode(stripslashes($_POST['categories']), true) : array();
            $brands = isset($_POST['brands']) ? json_decode(stripslashes($_POST['brands']), true) : array();
            $price_range = isset($_POST['price_range']) ? json_decode(stripslashes($_POST['price_range']), true) : array('min' => 0, 'max' => 1000);
            $sort_order = isset($_POST['sort_order']) ? sanitize_text_field($_POST['sort_order']) : null;
            $current_page = isset($_POST['page']) ? intval($_POST['page']) : 1;

            // Calculate products per page using WooCommerce settings
            $products_per_row = get_option('woocommerce_catalog_columns', 4);
            $rows_per_page = get_option('woocommerce_catalog_rows', 4);
            $products_per_page = $products_per_row * $rows_per_page;

            // Build WP_Query arguments
            $args = array(
                'post_type' => 'product',
                'post_status' => 'publish',
                'posts_per_page' => $products_per_page,
                'paged' => $current_page
            );

            // Add sorting logic
            if ($sort_order === null) {
                // Use WooCommerce default sorting when no sort_order is provided
                $default_catalog_orderby = get_option('woocommerce_default_catalog_orderby', 'menu_order');
                switch ($default_catalog_orderby) {
                    case 'menu_order':
                        $args['orderby'] = array('menu_order' => 'ASC', 'title' => 'ASC');
                        break;
                    case 'date':
                        $args['orderby'] = 'date';
                        $args['order'] = 'DESC';
                        break;
                    case 'price':
                        $args['meta_key'] = '_price';
                        $args['orderby'] = 'meta_value_num';
                        $args['order'] = 'ASC';
                        break;
                    case 'price-desc':
                        $args['meta_key'] = '_price';
                        $args['orderby'] = 'meta_value_num';
                        $args['order'] = 'DESC';
                        break;
                    case 'popularity':
                        $args['meta_key'] = 'total_sales';
                        $args['orderby'] = 'meta_value_num';
                        $args['order'] = 'DESC';
                        break;
                    case 'rating':
                        $args['meta_key'] = '_wc_average_rating';
                        $args['orderby'] = 'meta_value_num';
                        $args['order'] = 'DESC';
                        break;
                    default:
                        // Fallback to menu_order + title
                        $args['orderby'] = array('menu_order' => 'ASC', 'title' => 'ASC');
                        break;
                }
            } else {
                // Use custom sorting
                switch ($sort_order) {
                    case 'date_asc':
                        $args['orderby'] = 'date';
                        $args['order'] = 'ASC';
                        break;
                    case 'price_asc':
                        $args['meta_key'] = '_price';
                        $args['orderby'] = 'meta_value_num';
                        $args['order'] = 'ASC';
                        break;
                    case 'price_desc':
                        $args['meta_key'] = '_price';
                        $args['orderby'] = 'meta_value_num';
                        $args['order'] = 'DESC';
                        break;
                    case 'name_asc':
                        $args['orderby'] = 'title';
                        $args['order'] = 'ASC';
                        break;
                    case 'name_desc':
                        $args['orderby'] = 'title';
                        $args['order'] = 'DESC';
                        break;
                    case 'date_desc':
                        $args['orderby'] = 'date';
                        $args['order'] = 'DESC';
                        break;
                    default:
                        $args['orderby'] = 'date';
                        $args['order'] = 'DESC';
                        break;
                }
            }

        // Add tax query if filters are selected
        $tax_query = array();
        
        if (!empty($categories)) {
            $tax_query[] = array(
                'taxonomy' => 'product_cat',
                'field' => 'term_id',
                'terms' => array_map('intval', $categories),
                'operator' => 'IN'
            );
        }

        if (!empty($brands)) {
            $tax_query[] = array(
                'taxonomy' => 'product_brand',
                'field' => 'term_id',
                'terms' => array_map('intval', $brands),
                'operator' => 'IN'
            );
        }

        if (!empty($tax_query)) {
            if (count($tax_query) > 1) {
                $tax_query['relation'] = 'AND';
            }
            $args['tax_query'] = $tax_query;
        }

        // Add price range meta query
        $meta_query = array();
        if (!empty($price_range) && is_array($price_range)) {
            $min_price = isset($price_range['min']) ? floatval($price_range['min']) : 0;
            $max_price = isset($price_range['max']) ? floatval($price_range['max']) : 1000;
            
            // Only add price filter if it's not the default full range
            if ($min_price > 0 || $max_price < 1000) {
                $meta_query[] = array(
                    'key' => '_price',
                    'value' => array($min_price, $max_price),
                    'type' => 'NUMERIC',
                    'compare' => 'BETWEEN'
                );
            }
        }

        // Combine with existing meta_query if needed (for sorting by price)
        if (!empty($meta_query)) {
            if (isset($args['meta_key']) && $args['meta_key'] === '_price') {
                // If we're also sorting by price, we need to handle the meta_query differently
                $args['meta_query'] = $meta_query;
                // For sorting, we still need the meta_key and orderby
            } else {
                $args['meta_query'] = $meta_query;
            }
        }

        // Execute query
        $products_query = new \WP_Query($args);
        $posts = $products_query->posts;

        // Start output buffering to capture the HTML
        ob_start();
        
        if ($posts && !empty($posts)) {
            echo '<div class="woocommerce-products sm:mb-6 lg:mb-10">';
            echo '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
            
            foreach ($posts as $post) {
                // Use Timber::get_post to create Timber Post object properly
                $timber_post = \Timber\Timber::get_post($post->ID);
                
                // Render product card
                \Timber\Timber::render('woocommerce/product-card.twig', array(
                    'post' => $timber_post,
                    'show_brand' => true,
                    'show_sale_badge' => true
                ));
            }
            
            echo '</div>';
            echo '</div>';

            // Add pagination if needed
            if ($products_query->max_num_pages > 1) {
                // Create pagination context for AJAX filtering
                $pagination_context = array(
                    'pagination' => array(
                        'current' => $current_page,
                        'total' => $products_query->max_num_pages,
                        'prev' => array(
                            'page' => $current_page > 1 ? $current_page - 1 : null,
                            'found' => $current_page > 1
                        ),
                        'next' => array(
                            'page' => $current_page < $products_query->max_num_pages ? $current_page + 1 : null,
                            'found' => $current_page < $products_query->max_num_pages
                        ),
                        'pages' => array(),
                        'is_ajax' => true // Flag to indicate this is AJAX pagination
                    )
                );

                // Generate page numbers
                for ($i = 1; $i <= $products_query->max_num_pages; $i++) {
                    $pagination_context['pagination']['pages'][] = array(
                        'page' => $i,
                        'title' => $i,
                        'current' => ($i == $current_page)
                    );
                }

                \Timber\Timber::render('partial/pagination.twig', $pagination_context);
            }
        } else {
            echo '<div class="text-center py-12">';
            echo '<p class="text-gray-600 text-lg">' . __('No products were found matching your selection.', 'woocommerce') . '</p>';
            echo '</div>';
        }

        $html = ob_get_clean();

        // Reset global post data
        wp_reset_postdata();

            // Get updated filter counts based on current selection
            $updated_filters = $this->get_updated_filter_counts($categories, $brands, $price_range);

            // Return JSON response
            wp_send_json_success(array(
                'html' => $html,
                'found_posts' => $products_query->found_posts,
                'max_pages' => $products_query->max_num_pages,
                'updated_filters' => $updated_filters
            ));

        } catch (\Exception $e) {
            wp_send_json_error('Error: ' . $e->getMessage());
        }
    }

    /**
     * Get updated filter counts based on current filter selections
     */
    private function get_updated_filter_counts($current_categories, $current_brands, $current_price_range)
    {
        $updated_filters = array(
            'categories' => array(),
            'brands' => array()
        );

        // Get all categories
        $all_categories = get_terms(array(
            'taxonomy' => 'product_cat',
            'hide_empty' => false,
            'hierarchical' => true,
            'parent' => 0
        ));

        if ($all_categories && !is_wp_error($all_categories)) {
            foreach ($all_categories as $category) {
                // Count products for this category with current brand and price filters applied
                $count = $this->count_products_with_filters(
                    array($category->term_id), // This category
                    $current_brands,            // Current brand selection
                    $current_price_range        // Current price range
                );

                $updated_filters['categories'][$category->term_id] = $count;

                // Get child categories
                $children = get_terms(array(
                    'taxonomy' => 'product_cat',
                    'hide_empty' => false,
                    'parent' => $category->term_id
                ));

                if ($children && !is_wp_error($children)) {
                    foreach ($children as $child) {
                        $child_count = $this->count_products_with_filters(
                            array($child->term_id), // This child category
                            $current_brands,         // Current brand selection
                            $current_price_range     // Current price range
                        );
                        $updated_filters['categories'][$child->term_id] = $child_count;
                    }
                }
            }
        }

        // Get all brands
        $all_brands = get_terms(array(
            'taxonomy' => 'product_brand',
            'hide_empty' => false
        ));

        if ($all_brands && !is_wp_error($all_brands)) {
            foreach ($all_brands as $brand) {
                // Count products for this brand with current category and price filters applied
                $count = $this->count_products_with_filters(
                    $current_categories,        // Current category selection
                    array($brand->term_id),     // This brand
                    $current_price_range        // Current price range
                );

                $updated_filters['brands'][$brand->term_id] = $count;
            }
        }

        return $updated_filters;
    }

    /**
     * Count products with specific filter combinations
     */
    private function count_products_with_filters($categories, $brands, $price_range)
    {
        $args = array(
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'fields' => 'ids'
        );

        // Add tax query if filters are selected
        $tax_query = array();
        
        if (!empty($categories)) {
            $tax_query[] = array(
                'taxonomy' => 'product_cat',
                'field' => 'term_id',
                'terms' => array_map('intval', $categories),
                'operator' => 'IN'
            );
        }

        if (!empty($brands)) {
            $tax_query[] = array(
                'taxonomy' => 'product_brand',
                'field' => 'term_id',
                'terms' => array_map('intval', $brands),
                'operator' => 'IN'
            );
        }

        if (!empty($tax_query)) {
            if (count($tax_query) > 1) {
                $tax_query['relation'] = 'AND';
            }
            $args['tax_query'] = $tax_query;
        }

        // Add price range meta query
        if (!empty($price_range) && is_array($price_range)) {
            $min_price = isset($price_range['min']) ? floatval($price_range['min']) : 0;
            $max_price = isset($price_range['max']) ? floatval($price_range['max']) : 1000;
            
            // Only add price filter if it's not the default full range
            if ($min_price > 0 || $max_price < 1000) {
                $args['meta_query'] = array(
                    array(
                        'key' => '_price',
                        'value' => array($min_price, $max_price),
                        'type' => 'NUMERIC',
                        'compare' => 'BETWEEN'
                    )
                );
            }
        }

        $query = new \WP_Query($args);
        return $query->found_posts;
    }

    /**
     * AJAX handler for updating filter counts only (no product filtering)
     */
    public function update_filter_counts_only()
    {
        try {
            // Verify nonce
            if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'filter_products_nonce')) {
                wp_send_json_error('Security check failed');
                return;
            }

            // Get filter parameters
            $categories = isset($_POST['categories']) ? json_decode(stripslashes($_POST['categories']), true) : array();
            $brands = isset($_POST['brands']) ? json_decode(stripslashes($_POST['brands']), true) : array();
            $price_range = isset($_POST['price_range']) ? json_decode(stripslashes($_POST['price_range']), true) : array('min' => 0, 'max' => 1000);

            // Get updated filter counts based on current selection
            $updated_filters = $this->get_updated_filter_counts($categories, $brands, $price_range);

            // Return only the updated counts
            wp_send_json_success(array(
                'updated_filters' => $updated_filters
            ));

        } catch (\Exception $e) {
            wp_send_json_error('Error: ' . $e->getMessage());
        }
    }
}