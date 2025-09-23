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

        // Add Coverage Calculator sub-page
        acf_add_options_sub_page(array(
            'page_title' => 'Coverage Calculator Settings',
            'menu_title' => 'Coverage Calculator',
            'menu_slug'  => 'coverage-calculator',
            'capability' => 'edit_theme_options',
            'parent_slug' => 'theme-options'
        ));

        // Add Top Header Banner sub-page
        acf_add_options_sub_page(array(
            'page_title' => 'Top Header Banner Settings',
            'menu_title' => 'Top Header Banner',
            'menu_slug'  => 'top-header-banner',
            'capability' => 'edit_theme_options',
            'parent_slug' => 'theme-options'
        ));

        // Add Footer Action Buttons sub-page
        acf_add_options_sub_page(array(
            'page_title' => 'Footer Action Buttons Settings',
            'menu_title' => 'Footer Action Buttons',
            'menu_slug'  => 'footer-action-buttons',
            'capability' => 'edit_theme_options',
            'parent_slug' => 'theme-options'
        ));

        // Add Delivery Info sub-page
        acf_add_options_sub_page(array(
            'page_title' => 'Delivery Info Settings',
            'menu_title' => 'Delivery Info',
            'menu_slug'  => 'delivery-info',
            'capability' => 'edit_theme_options',
            'parent_slug' => 'theme-options'
        ));
    }
}