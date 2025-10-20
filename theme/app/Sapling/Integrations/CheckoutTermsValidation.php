<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class CheckoutTermsValidation implements SaplingPlugin
{
    public function init()
    {
        // Add server-side validation for terms and conditions
        add_action('woocommerce_checkout_process', array($this, 'validate_terms_checkbox'));
    }

    /**
     * Validate that terms and conditions checkbox is checked before processing order
     */
    public function validate_terms_checkbox()
    {
        // Check if terms page is set
        $terms_page_id = wc_terms_and_conditions_page_id();

        // Only validate if a terms page is configured
        if (!$terms_page_id) {
            return;
        }

        // Check if terms checkbox was submitted and checked
        // The value can be '1', 'on', or just the presence of the field
        if (empty($_POST['terms']) || ($_POST['terms'] !== '1' && $_POST['terms'] !== 'on')) {
            wc_add_notice(
                __('You must agree to the terms and conditions before placing your order.', 'sapling'),
                'error'
            );
        }
    }
}
