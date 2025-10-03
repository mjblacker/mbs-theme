document.addEventListener("alpine:init", () => {
  Alpine.data("cartDrawer", () => ({
    // State
    isOpen: false,
    loading: false,
    removing: false,
    cartItems: [],
    cartTotal: '$0.00',

    // Configuration
    cartUrl: window.wpEndpoints?.cartUrl || '/cart',
    checkoutUrl: window.wpEndpoints?.checkoutUrl || '/checkout',

    // Initialization
    init() {
      this.loadCartData();
      this.setupEventListeners();
    },

    setupEventListeners() {
      // Listen for cart updates from other components
      document.addEventListener('cart-updated', () => {
        if (this.isOpen) {
          this.loadCartData();
        }
      });

      // Listen for product added to cart
      document.addEventListener('added_to_cart', () => {
        this.loadCartData();
        // Optionally auto-open drawer when item is added
        // this.openDrawer();
      });
    },

    // Drawer Controls
    openDrawer() {
      this.isOpen = true;
      this.loadCartData();
      document.body.style.overflow = 'hidden';
    },

    closeDrawer() {
      this.isOpen = false;
      document.body.style.overflow = '';
    },

    // Cart Data Management
    async loadCartData() {
      this.loading = true;
      
      try {
        const response = await this.fetchCart();
        
        if (response.ok) {
          const data = await response.json();
          await this.processCartData(data);
        } else {
          this.resetCartState();
          console.error('Failed to load cart data');
        }
      } catch (error) {
        this.resetCartState();
        console.error('Error loading cart data:', error);
      } finally {
        this.loading = false;
      }
    },

    async fetchCart() {
      return fetch('/wp-json/wc/store/v1/cart', {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    },

    resetCartState() {
      this.cartItems = [];
      this.cartTotal = '$0.00';
    },

    async processCartData(cartData) {
      if (!cartData?.items) {
        this.resetCartState();
        return;
      }

      // Process cart items with brand and variation data
      const processedItems = await Promise.all(
        cartData.items.map(item => this.processCartItem(item))
      );

      this.cartItems = processedItems;
      this.cartTotal = this.formatPrice(cartData.totals.total_price);
    },

    async processCartItem(item) {
      const hasVariation = item.variation?.length > 0;

      const cartItem = {
        key: item.key,
        id: item.id,
        variation_id: hasVariation ? item.id : null,
        name: this.decodeHtmlEntities(item.name),
        quantity: item.quantity,
        line_total: item.totals.line_total,
        line_subtotal: item.totals.line_subtotal,
        image: item.images?.[0]?.src || null,
        brand: this.extractBrand(item),
        variations: this.extractVariations(item),
        permalink: item.permalink,
        is_variation: hasVariation
      };

      // Fetch brand separately if not found in cart data
      if (!cartItem.brand) {
        cartItem.brand = await this.fetchBrandForItem(item);
      }

      return cartItem;
    },

    decodeHtmlEntities(text) {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    },

    // Brand Extraction
    extractBrand(item) {
      // Check item meta
      if (item.meta?.brand) {
        return item.meta.brand;
      }
      
      // Check item extensions
      if (item.extensions?.brand) {
        return item.extensions.brand;
      }
      
      // Check product_brand taxonomy in categories
      if (Array.isArray(item.categories)) {
        const brandCategory = item.categories.find(cat => 
          cat.taxonomy === 'product_brand' || cat.slug?.includes('brand')
        );
        if (brandCategory) {
          return brandCategory.name;
        }
      }
      
      // Check item attributes for brand
      if (Array.isArray(item.variation)) {
        const brandAttribute = item.variation.find(attr => 
          attr.attribute && (
            attr.attribute.includes('brand') || 
            attr.attribute.includes('pa_brand') ||
            attr.attribute === 'attribute_pa_brand'
          )
        );
        if (brandAttribute?.value) {
          return brandAttribute.value;
        }
      }
      
      return null;
    },

    async fetchBrandForItem(item) {
      if (item.brand) return item.brand;
      
      try {
        // Extract product slug for variations
        const productSlug = this.extractProductSlug(item);
        
        // Try to get product by slug first (for variations)
        if (productSlug) {
          const brand = await this.fetchBrandBySlug(productSlug);
          if (brand) return brand;
        }
        
        // Fallback: Try by product ID
        return await this.fetchBrandById(item.id);
      } catch (error) {
        console.log('Could not fetch brand for item:', error);
        return 'BRAND NAME';
      }
    },

    extractProductSlug(item) {
      if (item.type === 'variation' && item.permalink) {
        const match = item.permalink.match(/\/product\/([^\/\?]+)/);
        return match?.[1];
      }
      return null;
    },

    async fetchBrandBySlug(productSlug) {
      const response = await fetch(`/wp-json/wp/v2/product?slug=${productSlug}&_embed=wp:term`, {
        credentials: 'same-origin'
      });
      
      if (response.ok) {
        const products = await response.json();
        if (products?.length > 0) {
          return this.extractBrandFromProduct(products[0]);
        }
      }
      return null;
    },

    async fetchBrandById(productId) {
      const response = await fetch(`/wp-json/wp/v2/product/${productId}?_embed=wp:term`, {
        credentials: 'same-origin'
      });
      
      if (response.ok) {
        const product = await response.json();
        return this.extractBrandFromProduct(product);
      }
      return null;
    },

    extractBrandFromProduct(product) {
      if (product._embedded?.['wp:term']) {
        const terms = product._embedded['wp:term'].flat();
        const brandTerm = terms.find(term => term.taxonomy === 'product_brand');
        return brandTerm?.name;
      }
      return null;
    },

    extractVariations(item) {
      const variations = {};
      
      if (item.variation) {
        item.variation.forEach(variation => {
          if (variation.attribute && variation.value) {
            const key = variation.attribute.replace('attribute_', '').replace('pa_', '');
            variations[key] = variation.value;
          }
        });
      }
      
      return variations;
    },

    // Cart Actions
    async updateQuantity(itemKey, newQuantity) {
      if (newQuantity < 1) {
        return this.removeItem(itemKey);
      }

      this.loading = true;

      try {
        const response = await this.makeStoreApiRequest('/wp-json/wc/store/v1/cart/update-item', {
          method: 'POST',
          body: JSON.stringify({
            key: itemKey,
            quantity: parseInt(newQuantity)
          })
        });

        if (response.ok) {
          await this.loadCartData();
          this.dispatchCartUpdateEvent();
        } else {
          console.error('Failed to update cart item');
          alert('Failed to update item quantity. Please try again.');
        }
      } catch (error) {
        console.error('Error updating cart item:', error);
        alert('Failed to update item quantity. Please try again.');
      } finally {
        this.loading = false;
      }
    },

    async removeItem(itemKey) {
      if (!confirm('Are you sure you want to remove this item from your cart?')) {
        return;
      }

      this.removing = true;

      try {
        // Primary method: DELETE to cart/items/{key}
        const response = await this.makeStoreApiRequest(`/wp-json/wc/store/v1/cart/items/${itemKey}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          await this.handleSuccessfulRemoval();
        } else {
          // Fallback method: POST with query parameter
          await this.tryFallbackRemoval(itemKey);
        }
      } catch (error) {
        console.error('Error removing cart item:', error);
        alert('Failed to remove item. Please try again.');
      } finally {
        this.removing = false;
      }
    },

    async tryFallbackRemoval(itemKey) {
      const fallbackResponse = await this.makeStoreApiRequest(`/wp-json/wc/store/v1/cart/remove-item?key=${itemKey}`, {
        method: 'POST'
      });

      if (fallbackResponse.ok) {
        await this.handleSuccessfulRemoval();
      } else {
        console.error('Failed to remove cart item');
        alert('Failed to remove item. Please try again.');
      }
    },

    async handleSuccessfulRemoval() {
      await this.loadCartData();
      this.dispatchCartUpdateEvent();
    },

    // API Helpers
    async makeStoreApiRequest(url, options = {}) {
      const defaultOptions = {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Nonce': window.wpEndpoints?.storeApiNonce || ''
        }
      };

      return fetch(url, { ...defaultOptions, ...options });
    },

    dispatchCartUpdateEvent() {
      document.dispatchEvent(new CustomEvent('cart-updated', {
        detail: { 
          source: 'drawer',
          cartCount: this.cartItems?.length || 0
        }
      }));
    },

    // Utilities
    formatPrice(price) {
      const numPrice = typeof price === 'string' ? 
        parseFloat(price.replace(/[^0-9.-]+/g, '')) : 
        parseFloat(price);
        
      const currency = window.wooCommerce_currency || '$';
      return `${currency}${(numPrice / 100).toFixed(2)}`;
    },

    // Getters
    get isEmpty() {
      return !this.cartItems?.length;
    }
  }));
});