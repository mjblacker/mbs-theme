<?php
/*
*
* We sometimes want defaults for a set of data from ACF
* Add it here
*
*/

// Only initialize if ACF Pro is available
if (class_exists('ACF')) {

    function mbs_locations() {
        $locations = get_field('locations', 'option') ?: array();

        if(empty($locations)) {
            // set the default locations data
            $locations = [
                [
                    'name' => 'Pakenham',
                    'address_lines' => '52-56 Peet Street',
                    'city_state' => 'Pakenham VIC 3810',
                    'phone' => '(03) 9707 0264',
                    'is_head_office' => true,
                    'location_image' => [
                        'url' => get_template_directory_uri() . '/assets/images/head-office.png',
                        'alt' => 'Pakenham location exterior'
                    ],
                    'get_direction_link' => 'https://google.com'
                ],
                [
                    'name' => 'Truganina',
                    'address_lines' => '52 National Drive',
                    'city_state' => 'Truganina VIC 3029',
                    'phone' => '(03) 9707 0264',
                    'is_head_office' => false,
                    'location_image' => [
                        'url' => get_template_directory_uri() . '/assets/images/2nd-office.png',
                        'alt' => 'Truganina location exterior'
                    ],
                    'get_direction_link' => '#'
                ]
            ];
        }

        return $locations;
    }

}
