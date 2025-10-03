<?php

namespace Sapling\Integrations;

use Sapling\SaplingPlugin;

class CheckoutAddressHandler implements SaplingPlugin
{
    public function init()
    {
        // Prevent WooCommerce from copying billing to shipping when shipping address exists
        add_filter('woocommerce_checkout_get_value', array($this, 'handle_checkout_field_values'), 10, 2);

        // Store ship_to_different_address checkbox state in session when checkout updates
        add_action('woocommerce_checkout_update_order_review', array($this, 'store_checkbox_state_on_update'));

        // Capture checkbox state changes via JavaScript integration
        add_action('wp_footer', array($this, 'add_checkbox_tracking_script'));

        // AJAX handlers to store checkbox state
        add_action('wp_ajax_store_ship_to_different', array($this, 'ajax_store_checkbox_state'));
        add_action('wp_ajax_nopriv_store_ship_to_different', array($this, 'ajax_store_checkbox_state'));
    }

    /**
     * Handle checkout field values to prevent WooCommerce from copying billing to shipping
     *
     * @param mixed $value Current field value
     * @param string $input Field name
     * @return mixed Modified field value
     */
    public function handle_checkout_field_values($value, $input)
    {
        if (!WC()->customer) {
            return $value;
        }

        // Handle ship_to_different_address checkbox state
        if ($input === 'ship_to_different_address') {
            // Check session for explicit checkbox state - respect user's choice
            $session_value = WC()->session->get('ship_to_different_address');
            if ($session_value !== null) {
                return $session_value;
            }

            // Only auto-check if addresses differ AND no explicit choice has been made
            $shipping_country = WC()->customer->get_shipping_country();
            $billing_country = WC()->customer->get_billing_country();
            $shipping_postcode = WC()->customer->get_shipping_postcode();
            $billing_postcode = WC()->customer->get_billing_postcode();

            if (!empty($shipping_country) && ($shipping_country !== $billing_country || $shipping_postcode !== $billing_postcode)) {
                return '1';
            }
        }

        // Return actual shipping field values instead of letting WooCommerce copy from billing
        $shipping_fields = array(
            'shipping_country' => 'get_shipping_country',
            'shipping_state' => 'get_shipping_state',
            'shipping_postcode' => 'get_shipping_postcode',
            'shipping_city' => 'get_shipping_city',
            'shipping_address_1' => 'get_shipping_address_1',
            'shipping_address_2' => 'get_shipping_address_2',
            'shipping_first_name' => 'get_shipping_first_name',
            'shipping_last_name' => 'get_shipping_last_name',
            'shipping_company' => 'get_shipping_company',
        );

        if (isset($shipping_fields[$input]) && method_exists(WC()->customer, $shipping_fields[$input])) {
            $shipping_value = WC()->customer->{$shipping_fields[$input]}();
            if (!empty($shipping_value)) {
                return $shipping_value;
            }
        }

        return $value;
    }

    /**
     * Store checkbox state when checkout updates via AJAX
     *
     * @param string $post_data Posted checkout data
     */
    public function store_checkbox_state_on_update($post_data)
    {
        parse_str($post_data, $data);
        if (WC()->session) {
            // Store checkbox state (1 if checked, 0 if unchecked)
            WC()->session->set('ship_to_different_address', isset($data['ship_to_different_address']) ? '1' : '0');
        }
    }

    /**
     * Add JavaScript to track checkbox changes in real-time
     */
    public function add_checkbox_tracking_script()
    {
        if (!is_checkout() || is_wc_endpoint_url('order-received')) {
            return;
        }
        ?>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            const checkbox = document.querySelector('#ship-to-different-address-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    // Store state change immediately when user toggles
                    const formData = new FormData();
                    formData.append('action', 'store_ship_to_different');
                    formData.append('value', this.checked ? '1' : '0');

                    fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                        method: 'POST',
                        body: formData,
                        credentials: 'same-origin'
                    });
                });
            }
        });
        </script>
        <?php
    }

    /**
     * AJAX handler to store checkbox state
     */
    public function ajax_store_checkbox_state()
    {
        if (WC()->session && isset($_POST['value'])) {
            WC()->session->set('ship_to_different_address', $_POST['value']);
        }
        wp_die();
    }
}
