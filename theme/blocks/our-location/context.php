<?php
/** @var array $context Timber Context array */

// Get locations data from theme options
$locations = get_field('locations', 'option');

// Process locations data and prepare for template
$processed_locations = [];

if ($locations && is_array($locations)) {
    foreach ($locations as $location) {
        // Process address lines into a single address string
        $address_parts = [];
        
        if (!empty($location['address_lines'])) {
            // Handle new textarea field - split by line breaks and filter empty lines
            $lines = explode("\n", $location['address_lines']);
            foreach ($lines as $line) {
                $line = trim($line);
                if (!empty($line)) {
                    $address_parts[] = $line;
                }
            }
        }
        
        // Add city and state if available
        if (!empty($location['city_state'])) {
            $address_parts[] = $location['city_state'];
        }
        
        // Combine address parts
        $full_address = implode(', ', $address_parts);
        
        $processed_locations[] = [
            'name' => $location['name'] ?? '',
            'address' => $full_address,
            'phone' => $location['phone'] ?? '',
            'is_head_office' => $location['is_head_office'] ?? false,
            'location_image' => $location['location_image'] ?? null,
            'get_direction_link' => $location['get_direction_link'] ?? '#'
        ];
    }
}

// Add processed locations to context
$context['locations'] = $processed_locations;

// Set block alignment classes
$block_classes = $context['block']['className'] ?? '';
$context['is_full_width'] = strpos($block_classes, 'alignfull') !== false;
$context['is_wide'] = strpos($block_classes, 'alignwide') !== false;

// Get ACF field values with defaults
$context['heading'] = get_field('heading') ?: 'Our Locations';
$context['sub_heading'] = get_field('sub_heading') ?: 'Find Metro Building Supplies near you with our convenient locations.';
$context['columns'] = get_field('columns') ?: '2';

// Ensure columns is a valid number between 1-4
$valid_columns = ['1', '2', '3', '4'];
if (!in_array($context['columns'], $valid_columns)) {
    $context['columns'] = '2';
}

// Generate CSS classes based on column count
$column_classes = [
    '1' => 'grid-cols-1',
    '2' => 'grid-cols-1 md:grid-cols-2',
    '3' => 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '4' => 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
];
$context['grid_classes'] = $column_classes[$context['columns']];

// Set default content for preview/fallback (kept for backward compatibility)
$context['default_heading'] = $context['heading'];
$context['default_description'] = $context['sub_heading'];

// If no locations are available, provide sample data for preview
if (empty($processed_locations) || ($context['is_preview'] ?? false)) {
    $context['locations'] = [
        [
            'name' => 'Pakenham - Head Office',
            'address' => '52-56 Peet Street, Pakenham VIC 3810',
            'phone' => '(03) 9707 0264',
            'is_head_office' => true,
            'location_image' => [
                'url' => get_template_directory_uri() . '/assets/images/head-office.png',
                'alt' => 'Pakenham location exterior'
            ],
            'get_direction_link' => '#'
        ],
        [
            'name' => 'Truganina',
            'address' => '52 National Drive, Truganina VIC 3029',
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