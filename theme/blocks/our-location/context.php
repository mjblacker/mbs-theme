<?php
/** @var array $context Timber Context array */

// Set block alignment classes
$block_classes = $context['block']['className'] ?? '';
$context['is_full_width'] = strpos($block_classes, 'alignfull') !== false;
$context['is_wide'] = strpos($block_classes, 'alignwide') !== false;

// Get columns setting with validation
$columns = get_field('columns') ?: '2';
$valid_columns = ['1', '2', '3', '4'];
$context['columns'] = in_array($columns, $valid_columns) ? $columns : '2';

// Generate grid CSS classes based on column count
$column_classes = [
    '1' => 'grid-cols-1',
    '2' => 'grid-cols-1 md:grid-cols-2',
    '3' => 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '4' => 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
];
$context['grid_classes'] = $column_classes[$context['columns']];
