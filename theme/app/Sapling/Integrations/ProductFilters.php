<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class ProductFilters implements SaplingPlugin
{
    public function init()
    {
        add_action('wp_ajax_filter_products', array($this, 'filter_products'));
        add_action('wp_ajax_nopriv_filter_products', array($this, 'filter_products'));
        add_action('wp_enqueue_scripts', array($this, 'localize_filter_script'));
    }

    public function localize_filter_script()
    {
        // Only localize on shop/archive pages
        if (is_shop() || is_product_category() || is_product_tag()) {
            // Try to localize to main script first (production)
            if (wp_script_is('main', 'enqueued')) {
                wp_localize_script('main', 'shopFiltersAjax', array(
                    'ajaxUrl' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('filter_products_nonce')
                ));
            } else {
                // Fallback: add to wp_head for development mode
                add_action('wp_head', function() {
                    echo '<script type="text/javascript">';
                    echo 'window.shopFiltersAjax = ' . json_encode(array(
                        'ajaxUrl' => admin_url('admin-ajax.php'),
                        'nonce' => wp_create_nonce('filter_products_nonce')
                    ));
                    echo ';</script>';
                }, 5);
            }
        }
    }

    public function filter_products()
    {
        try {
            // Debug logging
            error_log('ProductFilters: filter_products called');
            error_log('POST data: ' . print_r($_POST, true));

            // Verify nonce
            if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'filter_products_nonce')) {
                error_log('ProductFilters: Nonce verification failed');
                wp_send_json_error('Security check failed');
                return;
            }

            // Get filter parameters
            $categories = isset($_POST['categories']) ? json_decode(stripslashes($_POST['categories']), true) : array();
            $brands = isset($_POST['brands']) ? json_decode(stripslashes($_POST['brands']), true) : array();

            // Build WP_Query arguments
            $args = array(
                'post_type' => 'product',
                'post_status' => 'publish',
                'posts_per_page' => get_option('posts_per_page', 12)
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
                // Create pagination context
                $pagination_context = array(
                    'pagination' => array(
                        'current' => max(1, get_query_var('paged')),
                        'total' => $products_query->max_num_pages,
                        'prev' => array(
                            'link' => get_previous_posts_page_link(),
                            'found' => get_previous_posts_page_link() ? true : false
                        ),
                        'next' => array(
                            'link' => get_next_posts_page_link($products_query->max_num_pages),
                            'found' => get_next_posts_page_link($products_query->max_num_pages) ? true : false
                        ),
                        'pages' => array()
                    )
                );

                // Generate page links
                for ($i = 1; $i <= $products_query->max_num_pages; $i++) {
                    $pagination_context['pagination']['pages'][] = array(
                        'link' => get_pagenum_link($i),
                        'title' => $i,
                        'current' => ($i == max(1, get_query_var('paged')))
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

            // Return JSON response
            wp_send_json_success(array(
                'html' => $html,
                'found_posts' => $products_query->found_posts,
                'max_pages' => $products_query->max_num_pages
            ));

        } catch (\Exception $e) {
            wp_send_json_error('Error: ' . $e->getMessage());
        }
    }
}