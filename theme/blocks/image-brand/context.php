<?php
/** @var array $context Timber Context array */

// Add any additional context variables here if needed
// Example: process brand links, format images, etc.

// Detect alignment class for layout control
$block_classes = $context['block']['className'] ?? '';
$context['is_full_width'] = strpos($block_classes, 'alignfull') !== false;
$context['is_wide'] = strpos($block_classes, 'alignwide') !== false;
$context['alignment_class'] = '';

if ($context['is_full_width']) {
    $context['alignment_class'] = 'alignfull';
} elseif ($context['is_wide']) {
    $context['alignment_class'] = 'alignwide';
}

// Ensure default fallback values are available in context
if (empty($context['fields']['heading'])) {
    $context['fields']['heading'] = 'Trusted by Leading Brands';
}

if (empty($context['fields']['description'])) {
    $context['fields']['description'] = 'We\'re proud to work with industry-leading brands and partners who share our commitment to quality and excellence.';
}

// Process brand images and add default brands for preview if empty
if (empty($context['fields']['brands']) && isset($context['is_preview']) && $context['is_preview']) {
    // Add some default placeholder brands for preview
    $context['fields']['brands'] = [
        [
            'image' => [
                'url' => $context['theme']->link . '/assets/images/MBS_Logo.png',
                'alt' => 'Metro Building Supplies'
            ],
            'alt_text' => 'Metro Building Supplies',
            'link' => null
        ],
        [
            'image' => [
                'url' => $context['theme']->link . '/assets/images/Visa.png',
                'alt' => 'Visa'
            ],
            'alt_text' => 'Visa',
            'link' => null
        ],
        [
            'image' => [
                'url' => $context['theme']->link . '/assets/images/MasterCard.png',
                'alt' => 'MasterCard'
            ],
            'alt_text' => 'MasterCard',
            'link' => null
        ],
        [
            'image' => [
                'url' => $context['theme']->link . '/assets/images/MBS_Logo.png',
                'alt' => 'Brand 4'
            ],
            'alt_text' => 'Brand 4',
            'link' => null
        ]
    ];
}

// Process each brand to ensure proper data structure
if (!empty($context['fields']['brands'])) {
    foreach ($context['fields']['brands'] as $index => $brand) {
        // Ensure alt text fallback
        if (empty($brand['alt_text']) && !empty($brand['image']['alt'])) {
            $context['fields']['brands'][$index]['alt_text'] = $brand['image']['alt'];
        }
        
        // Process link data if present
        if (!empty($brand['link']) && is_array($brand['link'])) {
            // Ensure link has proper structure
            if (empty($brand['link']['url'])) {
                $context['fields']['brands'][$index]['link'] = null;
            }
        }
    }
}