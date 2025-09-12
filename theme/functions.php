<?php
/**
 * @package WordPress
 * @subpackage Timberland
 * @since Timberland 2.2.0
 */

require_once 'vendor/autoload.php';

Timber\Timber::init();
Timber::$dirname    = array( 'views', 'blocks' );
Timber::$autoescape = false;

// need a way to include more custom code/functions
include 'app/acf-defaults.php';

new Sapling();

