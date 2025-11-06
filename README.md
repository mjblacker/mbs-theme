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

There are the following commands to update the version of the theme as needed. This will update the style.css file with the incremented version number based on the update type.

```
lando version:patch  # For small fixes (0.1.3 → 0.1.4)
lando version:minor  # For new features (0.1.3 → 0.2.0)
lando version:major  # For breaking changes (0.1.3 → 2.0.0)
```

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

## MBS Theme Customization and Documentation

### Detailed File and Folder Structure

The theme follows a modular architecture with clear separation of concerns:

#### Core Application (`theme/app/Sapling/`)
- **Sapling.php** - Main theme class extending `Timber\Site`, handles asset management and WooCommerce integration
- **SaplingPlugin.php** - Plugin interface for modular functionality
- **FileUtils.php** - File utility functions for theme operations

#### Integration Classes (`theme/app/Sapling/Integrations/`)
These classes provide core functionality and extend WordPress/WooCommerce features:

- **AcfBlocks.php** - Auto-discovers and registers custom ACF blocks from the blocks/ directory. Supports both JSON-based (block.json) and PHP-based ([block-name]-block.php) block registration.

- **ProductFilters.php** - Handles AJAX product filtering with support for categories, brands, price ranges, and sorting. Provides two main AJAX actions: `filter_products` (returns filtered products) and `update_filter_counts` (updates filter counts without re-rendering products).

- **ShopFiltersData.php** - Prepares filter data for shop templates. Adds `shop_filters` array to Timber context containing hierarchical categories and brands with product counts.

- **ThemeOptions.php** - Registers ACF options pages for global theme settings including coverage calculator, top header banner, footer action buttons, delivery info, and category mega menu settings.

- **Breadcrumbs.php** - Generates breadcrumb navigation for WooCommerce pages (shop, category, product, cart, checkout, order complete).

- **CheckoutAddressHandler.php** - Manages checkout address validation and prevents WooCommerce from auto-copying billing to shipping addresses. Stores user's "ship to different address" choice in session.

- **CheckoutTermsValidation.php** - Server-side validation for terms & conditions checkbox during checkout.

- **WooCommercePricing.php** - Ensures sale prices display correctly in cart by preserving sale price data when adding items.

- **WooCommerceCoupon.php** - Custom AJAX coupon application/removal with duplicate checking and WooCommerce notice handling.

#### Assets Organization (`theme/assets/`)
- **dist/** - Compiled assets (output directory, gitignored)
- **fonts/** - Font files (Lexend font family)
- **images/** - Static images and patterns
- **js/** - Source JavaScript files:
  - `archive-product.js` - Shop filtering with Alpine.js components
  - `cart-drawer.js` - Cart drawer functionality
  - `single-product.js` - Product page interactions
  - `checkout-page.js` - Checkout functionality
- **styles/** - Source stylesheets:
  - `main.css` - Main stylesheet entry point
  - `editor-style.css` - Block editor styles
  - `theme.css` - Custom theme styles
  - `woocommerce.css` - WooCommerce-specific styles

#### View Templates (`theme/views/`)
- **base.twig** - Main layout template wrapping all pages
- **header.twig** - Header section template
- **footer.twig** - Footer section template
- **partial/** - Reusable template parts (header, footer, menus)
- **woocommerce/** - WooCommerce-specific templates
- **components/** - Component templates (filters, cart, checkout, product)

### Header and Footer Customization

#### Header Files
**Main template:** [theme/views/header.twig](theme/views/header.twig)

**Header components** located in [theme/views/partial/header/](theme/views/partial/header/):
- **logo.twig** - Company logo and branding
- **navigation.twig** - Desktop primary menu navigation
- **contact-button.twig** - Contact/call button (desktop & mobile)
- **cart.twig** - Shopping cart icon and drawer toggle
- **mobile-menu-button.twig** - Mobile menu hamburger button
- **mobile-menu-overlay.twig** - Full-screen mobile menu with categories grid

**Header Features:**
- Sticky positioning with WordPress admin bar compatibility
- Responsive: Desktop nav hidden on mobile, full-screen overlay menu on small screens
- Cart drawer integration (excluded on cart/checkout pages)
- Mobile menu includes category grid and featured sections
- Uses Primary Menu from WordPress menu system

**To customize the header:**
1. Edit [theme/views/header.twig](theme/views/header.twig) for layout changes
2. Modify individual component files in [theme/views/partial/header/](theme/views/partial/header/) for specific sections
3. Update Primary Menu in WordPress Admin → Appearance → Menus
4. Adjust styles in [theme/assets/styles/theme.css](theme/assets/styles/theme.css)

#### Footer Files
**Main template:** [theme/views/footer.twig](theme/views/footer.twig)

**Footer components** located in [theme/views/partial/footer/](theme/views/partial/footer/):
- **logo-section.twig** - Company logo and branding
- **categories-part1-section.twig** - First half of product categories
- **categories-part2-section.twig** - Second half of product categories
- **locations-section.twig** - Business locations with contact info
- **quick-links-section.twig** - General footer links
- **action-buttons-section.twig** - CTA buttons and payment method icons

**Footer Features:**
- 6-column responsive grid layout (1col → 2col → 3col → 6col)
- Dark gradient background with pattern overlay
- Three menu locations: Primary Menu, Footer Menu, Footer Categories
- Company info and locations from Theme Options (ACF)
- Copyright bar with dynamic company name

**To customize the footer:**
1. Edit [theme/views/footer.twig](theme/views/footer.twig) for layout changes
2. Modify individual component files in [theme/views/partial/footer/](theme/views/partial/footer/) for specific sections
3. Update Footer Menus in WordPress Admin → Appearance → Menus (Footer Menu, Footer Categories)
4. Configure locations and company info in WordPress Admin → Theme Options
5. Adjust styles in [theme/assets/styles/theme.css](theme/assets/styles/theme.css)

### Shop Archive: Filters and Categories

#### Shop Template Location
**Main shop page:** [theme/views/woocommerce/archive-product.twig](theme/views/woocommerce/archive-product.twig)

**Filter components:** [theme/views/components/archive-product/](theme/views/components/archive-product/)
- category-dropdown-filter.twig
- brand-filter-component.twig
- price-range-filter.twig
- sort-dropdown.twig
- apply-filters-button.twig

#### Enabling/Disabling AJAX Filtering

**Category Filter Mode** - In [archive-product.twig:82-83](theme/views/woocommerce/archive-product.twig#L82-L83):
```twig
is_link_category: true,     # Categories navigate to category URL (link mode)
is_link_category: false,    # Categories use AJAX filtering (filter mode)
```

When `is_link_category: true`:
- Clicking a category navigates to the category page URL
- Traditional page navigation (no AJAX)
- Better for SEO and direct links

When `is_link_category: false`:
- Clicking a category triggers AJAX product filtering
- Page doesn't reload, products update dynamically
- Faster user experience, allows multiple category selection

#### Expand/Collapse Category Settings

**Category Expansion** - In [archive-product.twig:84](theme/views/woocommerce/archive-product.twig#L84):
```twig
all_expanded_default: true,    # All parent categories start expanded
all_expanded_default: false,   # All parent categories start collapsed
```

**Category Filter Features:**
- Hierarchical display (parent + children)
- "Expand All" / "Collapse All" buttons
- "Clear" button to reset selections
- Visual indicators for current/selected categories
- Product counts shown in parentheses

**Brand Filter Collapse** - In [archive-product.twig:90-91](theme/views/woocommerce/archive-product.twig#L90-L91):
```twig
show_collapse: false,   # Hide collapse buttons (currently disabled)
show_collapse: true,    # Show collapse/expand buttons for brands
```

#### AJAX Filter Implementation

**Backend Handler:** [theme/app/Sapling/Integrations/ProductFilters.php](theme/app/Sapling/Integrations/ProductFilters.php)

**AJAX Actions:**
- `filter_products` - Filters products and returns HTML + updated filter counts
- `update_filter_counts` - Updates counts without filtering products

**Filter Data Provider:** [theme/app/Sapling/Integrations/ShopFiltersData.php](theme/app/Sapling/Integrations/ShopFiltersData.php)
- Provides hierarchical category structure with product counts
- Provides brand list with contextual product counts
- Adds `shop_filters` array to Timber context

**Frontend Logic:** [theme/assets/js/archive-product.js](theme/assets/js/archive-product.js)

**Alpine.js Components:**
- **shopFilters** - Main filtering state management and AJAX handling
- **categoryDropdownFilter** - Category selection and expansion logic
- **priceRangeFilter** - Price range slider control
- **filterComponent** - Generic filter for brands

**Available Filters:**
1. **Categories** - Hierarchical category filtering with parent/child relationships
2. **Brands** - Checkbox-based brand filtering (uses `product_brand` taxonomy)
3. **Price Range** - Dual-range slider ($0 - $1000, $10 increments)
4. **Sort Options** - Default, Latest, Oldest, Price (Low/High), Name (A-Z/Z-A)

#### Filter Customization

To modify filter behavior, edit these files:
1. **Filter display:** [theme/views/woocommerce/archive-product.twig](theme/views/woocommerce/archive-product.twig) (parameters at top)
2. **Filter components:** [theme/views/components/archive-product/](theme/views/components/archive-product/) (individual filter templates)
3. **Filter logic:** [theme/assets/js/archive-product.js](theme/assets/js/archive-product.js) (Alpine.js components)
4. **Backend processing:** [theme/app/Sapling/Integrations/ProductFilters.php](theme/app/Sapling/Integrations/ProductFilters.php)

### Theme Options and Global Settings

**Location:** WordPress Admin → Theme Options

**Available Options:**
- **Business Locations** (repeater)
  - Location Name
  - Address Lines
  - City & State
  - Phone Number
  - Head Office flag
  - Location Image
- **Company Information**
  - Company Name (used in footer)
  - Contact details
- **Alert Banner Settings** (top header banner)
- **Footer Action Buttons** (CTA buttons in footer)
- **Delivery Info** (product page delivery information)
- **Category Mega Menu** (mobile menu configuration)
- **Coverage Calculator Settings**

**ACF Field Groups:** Located in [theme/acf-json/](theme/acf-json/)
- group_theme_options.json
- group_coverage_calculator_options.json
- group_top_header_banner_options.json
- group_footer_action_buttons_options.json
- group_delivery_info_options.json
- group_category_mega_menu_options.json

### Menu Configuration

**WordPress Admin → Appearance → Menus**

Three menu locations available:
1. **Primary Menu** - Header navigation (desktop)
2. **Footer Menu** - Main footer links section
3. **Footer Categories** - Product categories in footer

All menus support multi-level hierarchies and are fully responsive.

### Block Development Reference

Custom blocks are located in [theme/blocks/](theme/blocks/). Each block contains:
- `block.json` OR `[block-name]-block.php` - Block registration
- `index.twig` OR `[block-name]-index.twig` - Block template
- `context.php` OR `[block-name]-context.php` - Optional data processing
- `style.css` - Block-specific styles (auto-included)
- `script.js` - Block-specific scripts (auto-included)

**Available Custom Blocks:**
- **category-loop** - Category carousel with Swiper
- **cta** - Call-to-action block
- **hero-masthead** - Hero banner block
- **icon-box** - Icon with text box
- **image-brand** - Image with brand logo
- **image-card** - Image card component
- **our-location** - Location showcase
- **product-loop** - Product grid with manual selection
- **example-faq** - Example FAQ block (PHP-based)
- **example-simple** - Example simple block (JSON-based)

**Block ACF Fields:** Each block has a corresponding ACF field group in [theme/acf-json/group_[block-name].json](theme/acf-json/)

Access fields in Twig templates: `{{ fields.field_name }}`

### Development Best Practices

1. **File Editing:** Always prefer editing existing files over creating new ones
2. **Timber/Twig:** All HTML is in Twig templates, not PHP files
3. **ACF Local JSON:** Field groups auto-sync to [theme/acf-json/](theme/acf-json/)
4. **Block Auto-Discovery:** Blocks in [theme/blocks/](theme/blocks/) are automatically registered
5. **Asset Building:** Run `lando dev` for development with hot reload, `lando build` for admin previews
6. **AJAX Security:** All AJAX requests use nonce verification (`filter_products_nonce`)
7. **Mobile-First:** Tailwind CSS responsive design (mobile → tablet → desktop)

### Key Configuration Files

- **style.css** - Theme header metadata and version
- **theme.json** - WordPress theme.json settings
- **config.json** - Vite environment configuration
- **composer.json** - PHP dependencies (PSR-4 autoloading)
- **package.json** - npm dependencies and scripts
- **vite.config.js** - Vite build configuration
- **.lando.yml** - Lando development environment

## License

MIT © Matt Blacker
MIT © Chris Earls
