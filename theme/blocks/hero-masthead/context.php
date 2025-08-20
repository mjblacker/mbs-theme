<?php
/** @var array $context Timber Context array */

// Add any additional context variables here if needed
// Example: process button link, format images, etc.

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
    $context['fields']['heading'] = 'Smart Buys, with Metro Building Supplies.';
}

if (empty($context['fields']['description'])) {
    $context['fields']['description'] = 'High quality products, delivered fast. Nobody beats Metro Building Supplies for service.';
}

if (empty($context['fields']['button_text'])) {
    $context['fields']['button_text'] = 'View All Products';
}

if (empty($context['fields']['background_color'])) {
    $context['fields']['background_color'] = '#374151';
}

if (empty($context['fields']['background_opacity'])) {
    $context['fields']['background_opacity'] = 90;
}