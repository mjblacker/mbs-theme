<?php

use Sapling;
use ACF;
use Timber\Timber;

class AcfBlocks implements Sapling\SaplingPlugin
{

    public function init()
    {
        if(!\class_exists(ACF::class)) {
            return;
        }

        // add in our hooks for this plugin
        add_action('acf/init', array( self::class, 'acf_register_blocks' ));
        add_filter('acf/blocks/wrap_frontend_innerblocks', array(self::class, 'acf_should_wrap_innerblocks'), 10, 2);

        // init the global functions for wordpress
        if(!function_exists('acf_block_render_callback')) {

            function acf_block_render_callback($block, $content)
            {
                $context           = Timber::context();
                $context['post']   = Timber::get_post();
                $context['block']  = $block;
                $context['fields'] = get_fields();
                $block_name        = explode('/', $block['name'])[1];
                $template          = 'blocks/'. $block_name . '/index.twig';

                // load the context filter file if it exists
                // change the context for this block here for this specific block
                $context_filter = get_template_directory(). '/blocks/'. $block_name . '/context.php';
                if(file_exists($context_filter)) {
                    include $context_filter;
                }

                Timber::render($template, $context);
            }
        }
    }

    public static function acf_register_blocks()
    {
        $blocks = array();

        foreach (new \DirectoryIterator(get_template_directory() . '/blocks') as $dir) {
            if ($dir->isDot()) {
                continue;
            }

            if (file_exists($dir->getPathname() . '/block.json')) {
                $blocks[] = $dir->getPathname();
            }
        }

        asort($blocks);

        foreach ($blocks as $block) {
            register_block_type($block);
        }
    }

    // Remove ACF block wrapper div
    public static function acf_should_wrap_innerblocks($wrap, $name)
    {
        return false;
    }

}
