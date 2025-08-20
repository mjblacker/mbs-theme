<?php
/**
 * Template Name: Full Width
 * 
 * Full Width Page Template
 * - Allows content to extend full viewport width
 * - Header/footer still use 1440px containers for consistency
 * - Block content can utilize full width as needed
 */

$context = Timber::context();
$timber_post = Timber::get_post();
$context['post'] = $timber_post;

Timber::render(array('page-fullwidth.twig', 'page.twig'), $context);