document.addEventListener("alpine:init", () => {
  const CartUtils = {
    selectors: {
      updateBtn: '.update-cart-btn',
      quantityInputs: '.cart-qty-input',
      notices: '.woocommerce-message, .woocommerce-info, .woocommerce-error'
    },

    classes: {
      disabled: ['opacity-50', 'cursor-not-allowed'],
      loading: ['opacity-75', 'cursor-not-allowed'],
      hover: ['hover:bg-[#FFF200]', 'hover:text-black']
    },

    createSpinner() {
      return '<svg class="animate-spin h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24">' +
             '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
             '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
             '</svg>';
    },

    fadeOutElement(element, delay = 4000) {
      setTimeout(() => {
        element.style.transition = 'opacity 0.5s ease-out';
        element.style.opacity = '0';
        setTimeout(() => element.remove(), 500);
      }, delay);
    },

    resetNoticeStyles(notice) {
      notice.removeAttribute('tabindex');
      notice.blur();
      Object.assign(notice.style, {
        outline: 'none',
        border: 'none',
        boxShadow: 'none'
      });
    },

  };

  Alpine.data("cartPage", () => ({
    updating: false,
    init() {
      this.autoHideNotices();
      this.setupUpdateButton();
      this.setupQuantityTracking();
    },

    autoHideNotices() {
      const notices = document.querySelectorAll(CartUtils.selectors.notices);
      
      notices.forEach(notice => {
        CartUtils.resetNoticeStyles(notice);
        CartUtils.fadeOutElement(notice);
      });
    },

    setupUpdateButton() {
      const updateBtn = document.querySelector(CartUtils.selectors.updateBtn);
      if (!updateBtn) return;

      updateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.updateCartAjax();
      });
    },

    setupQuantityTracking() {
      const quantityInputs = document.querySelectorAll(CartUtils.selectors.quantityInputs);
      const updateBtn = document.querySelector(CartUtils.selectors.updateBtn);
      
      if (!updateBtn) return;

      // Initially disable the button
      updateBtn.disabled = true;
      updateBtn.classList.add(...CartUtils.classes.disabled);

      quantityInputs.forEach((input) => {
        const originalValue = input.value;
        
        input.addEventListener('input', () => {
          const hasChanges = Array.from(quantityInputs).some(inp => inp.value !== inp.defaultValue);
          this.toggleUpdateButton(updateBtn, hasChanges);
        });
      });
    },

    toggleUpdateButton(button, enabled) {
      if (enabled) {
        button.disabled = false;
        button.classList.remove(...CartUtils.classes.disabled);
        button.classList.add(...CartUtils.classes.hover);
      } else {
        button.disabled = true;
        button.classList.add(...CartUtils.classes.disabled);
        button.classList.remove(...CartUtils.classes.hover);
      }
    },

    async updateCartAjax() {
      this.updating = true;
      const updateBtn = document.querySelector(CartUtils.selectors.updateBtn);
      
      if (updateBtn) {
        updateBtn.disabled = true;
        updateBtn.classList.add(...CartUtils.classes.loading);
        updateBtn.innerHTML = `${CartUtils.createSpinner()}<span class="text-black">Updating Cart...</span>`;
      }

      try {
        const quantityInputs = document.querySelectorAll(CartUtils.selectors.quantityInputs);
        const updates = [];
        
        quantityInputs.forEach(input => {
          const itemKey = input.name.match(/cart\[(.*?)\]/)?.[1];
          if (itemKey && input.value !== input.defaultValue) {
            updates.push({
              key: itemKey,
              quantity: parseInt(input.value) || 0
            });
          }
        });

        // Process all updates
        for (const update of updates) {
          if (update.quantity === 0) {
            await this.removeItemByKey(update.key);
          } else {
            await this.updateQuantityByKey(update.key, update.quantity);
          }
        }

        // Refresh cart content and totals
        await this.refreshCartFragments();
        this.dispatchCartUpdateEvent();
        
        // Reset update button
        if (updateBtn) {
          updateBtn.disabled = true;
          updateBtn.classList.remove(...CartUtils.classes.loading);
          updateBtn.classList.add(...CartUtils.classes.disabled);
          updateBtn.innerHTML = 'Update Cart';
        }

      } catch (error) {
        console.error('Error updating cart:', error);
        alert('Failed to update cart. Please try again.');
      } finally {
        this.updating = false;
      }
    },

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

    async updateQuantityByKey(itemKey, newQuantity) {
      const response = await this.makeStoreApiRequest('/wp-json/wc/store/v1/cart/update-item', {
        method: 'POST',
        body: JSON.stringify({
          key: itemKey,
          quantity: parseInt(newQuantity)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update item quantity');
      }
      
      return response;
    },

    async removeItemByKey(itemKey) {
      const response = await this.makeStoreApiRequest(`/wp-json/wc/store/v1/cart/items/${itemKey}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      // Remove the item element from DOM
      const itemElement = document.querySelector(`input[name*="${itemKey}"]`)?.closest('.cart-item');
      if (itemElement) {
        itemElement.style.transition = 'opacity 0.3s ease-out';
        itemElement.style.opacity = '0';
        setTimeout(() => itemElement.remove(), 300);
      }
      
      return response;
    },

    async refreshCartFragments() {
      const cartItemsSection = document.querySelector('.cart-items-section');
      const cartTotals = document.querySelector('.lg\\:col-span-5');
      
      // Disable cart areas during refresh
      this.disableCartAreas(cartItemsSection, cartTotals);
      
      try {
        // Fetch updated cart page content
        const response = await fetch(window.location.href, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch updated cart content');
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Update only the cart items section (not the related products)
        const currentCartItemsSection = document.querySelector('.cart-items-section');
        const newCartItemsSection = doc.querySelector('.cart-items-section');
        
        if (currentCartItemsSection && newCartItemsSection) {
          // Preserve Alpine.js data by updating innerHTML instead of replacing element
          currentCartItemsSection.innerHTML = newCartItemsSection.innerHTML;
          
          // Reinitialize Alpine.js components for the updated content
          if (window.Alpine) {
            Alpine.initTree(currentCartItemsSection);
          }
        }

        // Update cart totals area
        const currentCartTotals = document.querySelector('.lg\\:col-span-5');
        const newCartTotals = doc.querySelector('.lg\\:col-span-5');
        
        if (currentCartTotals && newCartTotals) {
          currentCartTotals.innerHTML = newCartTotals.innerHTML;
          
          // Reinitialize Alpine.js for totals if needed
          if (window.Alpine) {
            Alpine.initTree(currentCartTotals);
          }
        }

        // Re-setup the update button and quantity tracking for new content
        this.setupUpdateButton();
        this.setupQuantityTracking();

      } catch (error) {
        console.error('Error refreshing cart fragments:', error);
        // Fallback to page reload if fragment update fails
        window.location.reload();
      } finally {
        // Re-enable cart areas after refresh
        this.enableCartAreas(cartItemsSection, cartTotals);
      }
    },

    disableCartAreas(cartContent, cartTotals) {
      [cartContent, cartTotals].forEach(area => {
        if (area) {
          // Add simple disabled styling
          area.classList.add('opacity-50', 'pointer-events-none');
          
          // Disable all interactive elements including checkout buttons
          const interactiveElements = area.querySelectorAll('button, input, a, select, .checkout-button, [href*="checkout"]');
          interactiveElements.forEach(el => {
            const wasDisabled = el.disabled || el.classList.contains('disabled');
            el.disabled = true;
            el.classList.add('disabled');
            el.setAttribute('data-was-disabled', wasDisabled ? 'true' : 'false');
          });
        }
      });
    },

    enableCartAreas(cartContent, cartTotals) {
      [cartContent, cartTotals].forEach(area => {
        if (area) {
          // Remove disabled styling
          area.classList.remove('opacity-50', 'pointer-events-none');
          
          // Re-enable interactive elements
          const interactiveElements = area.querySelectorAll('[data-was-disabled]');
          interactiveElements.forEach(el => {
            const wasDisabled = el.getAttribute('data-was-disabled') === 'true';
            el.disabled = wasDisabled;
            if (!wasDisabled) {
              el.classList.remove('disabled');
            }
            el.removeAttribute('data-was-disabled');
          });
        }
      });
    },

    dispatchCartUpdateEvent() {
      document.dispatchEvent(new CustomEvent('cart-updated', {
        detail: { 
          source: 'cart-page'
        }
      }));
    },

    updateCart() {
      // Fallback for any remaining form submissions
      this.updateCartAjax();
    }
  }));

  Alpine.data("cartItem", () => ({
    removing: false,
    
    async removeItem(itemKey) {
      if (!confirm('Are you sure you want to remove this item from your cart?')) {
        return;
      }

      this.removing = true;
      
      // Get reference to cart page component for fragment refresh
      const cartPageElement = document.querySelector('[x-data*="cartPage"]');
      const cartPageData = cartPageElement ? Alpine.$data(cartPageElement) : null;

      try {
        const response = await this.makeStoreApiRequest(`/wp-json/wc/store/v1/cart/items/${itemKey}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          // Remove the item from DOM immediately for instant feedback
          this.$el.style.transition = 'opacity 0.3s ease-out';
          this.$el.style.opacity = '0';
          
          setTimeout(async () => {
            this.$el.remove();
            
            // Refresh cart fragments like the update cart button does
            if (cartPageData && cartPageData.refreshCartFragments) {
              await cartPageData.refreshCartFragments();
            }
          }, 300);
          
          this.dispatchCartUpdateEvent();
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
          source: 'cart-page'
        }
      }));
    },

    get removeButtonClasses() {
      return {
        'opacity-50 cursor-not-allowed': this.removing,
        'hover:text-red-500': !this.removing
      };
    }
  }));
});