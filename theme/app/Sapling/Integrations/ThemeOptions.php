<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class ThemeOptions implements SaplingPlugin
{
    public function init()
    {
        // Only initialize if ACF Pro is available
        if (!\class_exists('ACF') || !function_exists('acf_add_options_page')) {
            return;
        }

        // Register ACF Options page
        add_action('acf/init', array($this, 'register_options_page'));
    }

    public function register_options_page()
    {
        // Check if function exists to prevent errors
        if (!function_exists('acf_add_options_page')) {
            return;
        }

        // Add main theme options page
        acf_add_options_page(array(
            'page_title' => 'Theme Options',
            'menu_title' => 'Theme Options', 
            'menu_slug'  => 'theme-options',
            'capability' => 'edit_theme_options',
            'icon_url'   => 'dashicons-admin-generic',
            'position'   => 59,
            'redirect'   => false
        ));
    }
}