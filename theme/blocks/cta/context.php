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
    $context['fields']['heading'] = 'Need it fast? Call us today.';
}

if (empty($context['fields']['sub_heading'])) {
    $context['fields']['sub_heading'] = "Haven't got time to wait? Call us today for a quote and to see if we can help.";
}

if (empty($context['fields']['button_text'])) {
    $context['fields']['button_text'] = 'Contact us for a Quote';
}

if (empty($context['fields']['background_type'])) {
    $context['fields']['background_type'] = 'color';
}

if (empty($context['fields']['background_color'])) {
    $context['fields']['background_color'] = '#FFF200';
}

if (empty($context['fields']['text_color'])) {
    $context['fields']['text_color'] = 'dark';
}

if (empty($context['fields']['button_style'])) {
    $context['fields']['button_style'] = 'dark';
}

if (empty($context['fields']['overlay_opacity'])) {
    $context['fields']['overlay_opacity'] = 50;
}

// Handle backward compatibility for old background_image field
// If the old single background_image field exists and new responsive fields don't, use the old one
if (!empty($context['fields']['background_image']) && 
    empty($context['fields']['background_image_desktop']) && 
    empty($context['fields']['background_image_mobile'])) {
    
    $context['fields']['background_image_desktop'] = $context['fields']['background_image'];
    $context['fields']['background_image_mobile'] = $context['fields']['background_image'];
}

// Ensure fallback behavior: if desktop image exists but mobile doesn't, use desktop for mobile
if (!empty($context['fields']['background_image_desktop']) && 
    empty($context['fields']['background_image_mobile'])) {
    $context['fields']['background_image_mobile'] = $context['fields']['background_image_desktop'];
}