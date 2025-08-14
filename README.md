# Sapling :evergreen_tree:

Sapling is an opinionated WordPress theme based on Sapling using [Lando](https://lando.dev/), [Timber](https://www.upstatement.com/timber/), [Advanced Custom Fields Pro](https://www.advancedcustomfields.com/), [Vite](https://vitejs.dev/), [Tailwind](https://tailwindcss.com/) and [Alpine.js](https://github.com/alpinejs/alpine).

Sapling uses the WordPress block editor to visually edit the site. This is made possible by the [ACF Blocks feature](https://www.advancedcustomfields.com/resources/blocks/). *ACF Pro license is required for this feature.*

Sapling runs on Lando (docker) to make developement consistent between all developers. It will install WordPress into a `wp` directory and symlink the theme, this allows the theme to contain everything it needs to run for development.

Built and Maintained by [Aspire Web](https://aspireweb.com.au)

## Installation

1. Clone or download zip of repository to your development directory.
2. Run `lando start` in the theme directory.
3. Run `lando install` in the theme directory and follow the instructions to install WordPress.
4. Make sure you have installed [Advanced Custom Fields Pro](https://www.advancedcustomfields.com/)
5. (optional) Restore database/files to the `wp` directory in the folder containing the WordPress install.

## Development

Sapling builds your css and js files using Vite. This allows you to use the latest Javascript and CSS features.

To get started:
1. Run `lando build` to generate assets that can be used in the admin block editor. This only needs to be run as often as you want to see updated block previews in the admin.
2. Run `lando dev` to start the Vite dev server.
3. Run `lando dev-debug` to start the Vite dev server in debug mode.
4. Run `lando debug` to start viewing the WordPress debug logs.

If you need to restore the build process to defaults, run `lando clean` and this will remove the js module, php vendor file and wp install. This is typically only done when you need to run `lando destroy` to reset the theme build files.

### Live Reload

Live reload is enabled by default using Vite.

### Versioning

To assist with long-term caching, file hashing (e.g. `main-e1457bfd.js`) is enabled by default. This is useful for cache-busting purposes.

## Production

When you're ready for production, run `lando bundle` from the theme directory. You can test production assets in development by setting the vite → environment property to "production" in config.json.
The bundle command will produce a zip that includes the theme as named in `package.json` that is ready to upload to the server or through WordPress theme upload feature.

If you're developing locally and moving files to your production environment, only the `theme` directory is needed. Ensure the `vendor` and `assets/dist` directories exists in the theme directory.

```
  trailhead/
  ├── theme/ (this folder is copied and renamed)
      ├── vendor/
```

## Blocks

A block is a self-contained page section and includes its own template, script, style, functions and block.json files.

```
  example/
  ├── block.json
  ├── functions.php
  ├── index.twig
  ├── script.js
  ├── style.css
```

To create a new block, create a directory in `theme/blocks`. Add your `index.twig` and `block.json` files and it's ready to be used with the WordPress block editor. You can optionally add style.css, script.js and functions.php files. An example block is provided for reference. Add editable fields by creating a new ACF field group and setting the location rule to your new block. You can now use these fields with your block in the block editor.

### Accessing Fields

You access your block's fields in the index.twig file by using the `fields` variable. The example below shows how to display a block's field. We'll use "heading" as the example ACF field name, but it could be whatever name you give your field.

`{{ fields.heading }}`

Here's an example of how to loop through a repeater field where "features" is the ACF field name and the repeater field has a heading field.

```
{% for feature in fields.features %}
{{ feature.heading }}
{% endfor %}
```

## Directory Structure

`theme/` contains all of the WordPress core templates files.

`theme/acf-json/` contain all of your Advanced Custom Fields json files. These files are automatically created/updated using ACF's Local JSON feature.

`theme/assets/` contain all of your fonts, images, styles and scripts.

`theme/blocks/` contain all of your site's blocks. These blocks are available to use on any page via the block editor. Each block has its own template, script and style files.
There are two ways to create blocks:
- JSON: These use the block.json file to specify the details of the block
- PHP: These use a block.php file to specify the details of the block
This is purely personal preference and you can mix both in a single project. When using the php blocks we will also bundle in the ACF Fields for the block so the block can be re-used on different themes without any adjustment to ACF field groups required.

`theme/patterns/` contains all of your sites's block patterns. Block Patterns are a collection of predefined blocks that you can insert into pages and posts and then customize with your own content.

`theme/views/` contains all of your Twig templates. These pretty much correspond 1 to 1 with the PHP files that respond to the WordPress template hierarchy. At the end of each PHP template, you'll notice a `Timber::render()` function whose first parameter is the Twig file where that data (or `$context`) will be used.

## License

MIT © Matt Blacker
MIT © Chris Earls
