document.addEventListener("alpine:init", () => {
  Alpine.data("cartDrawer", () => ({
    isOpen: false,
    loading: false,
    cartItems: [],
    cartTotal: '$0.00',
    cartUrl: window.wpEndpoints?.cartUrl || '/cart',
    checkoutUrl: window.wpEndpoints?.checkoutUrl || '/checkout',
    removing: false,

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

    openDrawer() {
      this.isOpen = true;
      this.loadCartData();
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    },

    closeDrawer() {
      this.isOpen = false;
      // Restore body scroll
      document.body.style.overflow = '';
    },

    async loadCartData() {
      this.loading = true;
      
      try {
        const response = await fetch('/wp-json/wc/store/cart', {
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          await this.processCartData(data);
        } else {
          console.error('Failed to load cart data');
          this.cartItems = [];
          this.cartTotal = '$0.00';
        }
      } catch (error) {
        console.error('Error loading cart data:', error);
        this.cartItems = [];
        this.cartTotal = '$0.00';
      } finally {
        this.loading = false;
      }
    },

    async processCartData(cartData) {
      if (!cartData || !cartData.items) {
        this.cartItems = [];
        this.cartTotal = '$0.00';
        return;
      }

      
      // Process cart items
      const processedItems = await Promise.all(cartData.items.map(async (item) => {
        // Check if this is a variation product
        const hasVariation = item.variation && item.variation.length > 0;
        
        const cartItem = {
          key: item.key,
          id: item.id,
          variation_id: hasVariation ? item.id : null, // For variations, store the variation ID
          name: item.name, // WooCommerce Store API should provide the parent product name for variations
          quantity: item.quantity,
          line_total: item.totals.line_total,
          line_subtotal: item.totals.line_subtotal,
          image: item.images?.[0]?.src || null,
          brand: this.extractBrand(item),
          variations: this.extractVariations(item),
          permalink: item.permalink,
          is_variation: hasVariation
        };

        // If brand wasn't found in cart data, fetch it separately
        if (!cartItem.brand) {
          cartItem.brand = await this.fetchBrandForItem(item);
        }

        return cartItem;
      }));

      this.cartItems = processedItems;

      // Format cart total
      this.cartTotal = this.formatPrice(cartData.totals.total_price);
    },

    extractBrand(item) {
      // Try to extract brand from various possible locations in cart data
      
      // 1. Check item meta
      if (item.meta && item.meta.brand) {
        return item.meta.brand;
      }
      
      // 2. Check item extensions (WooCommerce extensions might store here)
      if (item.extensions && item.extensions.brand) {
        return item.extensions.brand;
      }
      
      // 3. Check for product_brand taxonomy in categories
      if (item.categories && Array.isArray(item.categories)) {
        const brandCategory = item.categories.find(cat => 
          cat.taxonomy === 'product_brand' || cat.slug?.includes('brand')
        );
        if (brandCategory) {
          return brandCategory.name;
        }
      }
      
      // 4. Check item attributes for brand
      if (item.variation && Array.isArray(item.variation)) {
        const brandAttribute = item.variation.find(attr => 
          attr.attribute && (
            attr.attribute.includes('brand') || 
            attr.attribute.includes('pa_brand') ||
            attr.attribute === 'attribute_pa_brand'
          )
        );
        if (brandAttribute && brandAttribute.value) {
          return brandAttribute.value;
        }
      }
      
      // 5. If brand data isn't in cart API, we'll fetch it separately
      // This will be handled by fetchBrandForItem method
      return null;
    },

    async fetchBrandForItem(item) {
      // Fetch brand data separately if not included in cart API
      if (item.brand) return item.brand; // Already has brand
      
      try {
        let productSlug = null;
        let productId = item.id;
        
        // If this is a variation, extract parent product slug from permalink
        if (item.type === 'variation' && item.permalink) {
          const match = item.permalink.match(/\/product\/([^\/\?]+)/);
          if (match) {
            productSlug = match[1]; // Extract "est-ut" from the permalink
          }
        }
        
        // Try to get product by slug first (for variations)
        if (productSlug) {
          const slugResponse = await fetch(`/wp-json/wp/v2/product?slug=${productSlug}&_embed=wp:term`, {
            credentials: 'same-origin'
          });
          
          if (slugResponse.ok) {
            const products = await slugResponse.json();
            if (products && products.length > 0) {
              const product = products[0];
              
              // Look for product_brand taxonomy in embedded terms
              if (product._embedded && product._embedded['wp:term']) {
                const terms = product._embedded['wp:term'].flat();
                const brandTerm = terms.find(term => term.taxonomy === 'product_brand');
                
                if (brandTerm) {
                  return brandTerm.name;
                }
              }
            }
          }
        }
        
        // Fallback: Try by product ID (for simple products or if slug method failed)
        const response = await fetch(`/wp-json/wp/v2/product/${productId}?_embed=wp:term`, {
          credentials: 'same-origin'
        });
        
        if (response.ok) {
          const product = await response.json();
          
          // Look for product_brand taxonomy in embedded terms
          if (product._embedded && product._embedded['wp:term']) {
            const terms = product._embedded['wp:term'].flat();
            const brandTerm = terms.find(term => term.taxonomy === 'product_brand');
            
            if (brandTerm) {
              return brandTerm.name;
            }
          }
        }
      } catch (error) {
        console.log('Could not fetch brand for item:', error);
      }
      
      return 'BRAND NAME'; // Fallback
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

    async updateQuantity(itemKey, newQuantity) {
      if (newQuantity < 1) {
        this.removeItem(itemKey);
        return;
      }

      this.loading = true;

      try {
        const response = await fetch('/wp-json/wc/store/cart/update-item', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': window.wpEndpoints?.nonce || ''
          },
          body: JSON.stringify({
            key: itemKey,
            quantity: parseInt(newQuantity)
          })
        });

        if (response.ok) {
          await this.loadCartData();
          
          // Trigger cart update event for badge
          document.dispatchEvent(new CustomEvent('cart-updated', {
            detail: { source: 'drawer' }
          }));
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
        const response = await fetch('/wp-json/wc/store/cart/remove-item', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': window.wpEndpoints?.nonce || ''
          },
          body: JSON.stringify({
            key: itemKey
          })
        });

        if (response.ok) {
          await this.loadCartData();
          
          // Trigger cart update event for badge
          document.dispatchEvent(new CustomEvent('cart-updated', {
            detail: { source: 'drawer' }
          }));
        } else {
          console.error('Failed to remove cart item');
          alert('Failed to remove item. Please try again.');
        }
      } catch (error) {
        console.error('Error removing cart item:', error);
        alert('Failed to remove item. Please try again.');
      } finally {
        this.removing = false;
      }
    },

    formatPrice(price) {
      // Handle both string and number prices
      const numPrice = typeof price === 'string' ? 
        parseFloat(price.replace(/[^0-9.-]+/g, '')) : 
        parseFloat(price);
        
      const currency = window.woocommerce_currency || '$';
      return `${currency}${(numPrice / 100).toFixed(2)}`;
    },

    get isEmpty() {
      return !this.cartItems || this.cartItems.length === 0;
    }
  }));
});