// Cart Page Components
document.addEventListener("alpine:init", () => {
  // Cart Page Component
  Alpine.data("cartPage", () => ({
    updating: false,
    
    init() {
      this.initializeCartUpdateButton();
      this.setupQuantityHandlers();
      this.autoHideNotices();
    },

    initializeCartUpdateButton() {
      const updateBtn = document.querySelector('.update-cart-btn');
      const quantityInputs = document.querySelectorAll('.cart-qty-input');
      
      if (updateBtn) {
        updateBtn.disabled = false;
        updateBtn.removeAttribute('disabled');
        
        updateBtn.addEventListener('click', (e) => {
          const hiddenInput = document.createElement('input');
          hiddenInput.type = 'hidden';
          hiddenInput.name = 'update_cart';
          hiddenInput.value = 'Update cart';
          updateBtn.form.appendChild(hiddenInput);
          
          this.showCartLoading(updateBtn);
          
          setTimeout(() => {
            updateBtn.form.submit();
          }, 100);
        });
        
        quantityInputs.forEach((input) => {
          const originalValue = input.value;
          
          input.addEventListener('input', () => {
            if (input.value !== originalValue) {
              updateBtn.disabled = false;
              updateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
              updateBtn.classList.add('hover:bg-[#FFF200]');
            }
          });
        });
      }
    },

    showCartLoading(btn) {
      btn.disabled = true;
      btn.classList.add('opacity-75', 'cursor-not-allowed');
      btn.innerHTML = '<svg class="animate-spin h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 8 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Updating...';
    },

    autoHideNotices() {
      const notices = document.querySelectorAll('.woocommerce-message, .woocommerce-info, .woocommerce-error');
      notices.forEach(notice => {
        // Remove focus and fix styling issues
        notice.removeAttribute('tabindex');
        notice.blur();
        notice.style.outline = 'none';
        notice.style.border = 'none';
        notice.style.boxShadow = 'none';
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
          notice.style.transition = 'opacity 0.5s ease-out';
          notice.style.opacity = '0';
          setTimeout(() => {
            notice.remove();
          }, 500);
        }, 4000);
      });
    },

    setupQuantityHandlers() {
      const quantityInputs = document.querySelectorAll('.cart-qty-input');
      quantityInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.updateCart();
          }
        });
      });
    },

    updateCart() {
      const form = document.querySelector('.woocommerce-cart-form');
      if (form) {
        form.submit();
      }
    },

    removeItem(cartItemKey) {
      if (confirm('Are you sure you want to remove this item from your cart?')) {
        const removeUrl = `/cart/?remove_item=${cartItemKey}&_wpnonce=${this.getCartNonce()}`;
        window.location.href = removeUrl;
      }
    },

    getCartNonce() {
      const nonceInput = document.querySelector('[name="woocommerce-cart-nonce"]');
      return nonceInput ? nonceInput.value : '';
    }
  }));

  // Cart Item Component (for individual cart items)
  Alpine.data("cartItem", (cartItemKey) => ({
    removing: false,
    
    async removeItem() {
      if (!confirm('Are you sure you want to remove this item from your cart?')) {
        return;
      }

      this.removing = true;

      try {
        // Get the remove URL from the link
        const removeLink = this.$el.querySelector('.remove-item');
        if (removeLink && removeLink.href) {
          window.location.href = removeLink.href;
        }
      } catch (error) {
        console.error('Error removing cart item:', error);
        alert('Failed to remove item. Please try again.');
      } finally {
        this.removing = false;
      }
    },

    get removeButtonClasses() {
      return {
        'opacity-50 cursor-not-allowed': this.removing,
        'hover:text-red-500': !this.removing,
      };
    }
  }));
});