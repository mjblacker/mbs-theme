document.addEventListener("alpine:init", () => {
  const CartUtils = {
    selectors: {
      updateBtn: '.update-cart-btn',
      quantityInputs: '.cart-qty-input',
      cartForm: '.woocommerce-cart-form',
      removeLink: '.remove-item',
      cartNonce: '[name="woocommerce-cart-nonce"]',
      notices: '.woocommerce-message, .woocommerce-info, .woocommerce-error'
    },

    classes: {
      disabled: ['opacity-50', 'cursor-not-allowed'],
      loading: ['opacity-75', 'cursor-not-allowed'],
      hover: ['hover:bg-[#FFF200]', 'hover:text-red-500']
    },

    createSpinner() {
      return '<svg class="animate-spin h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24">' +
             '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
             '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 8 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
             '</svg>';
    },

    createHiddenInput(name, value) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      return input;
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

    getCartNonce() {
      const nonceInput = document.querySelector(this.selectors.cartNonce);
      return nonceInput?.value || '';
    }
  };

  Alpine.data("cartPage", () => ({
    updating: false,
    hasChanges: false,
    
    init() {
      this.initializeCartUpdateButton();
      this.setupQuantityHandlers();
      this.autoHideNotices();
    },

    initializeCartUpdateButton() {
      const updateBtn = document.querySelector(CartUtils.selectors.updateBtn);
      const quantityInputs = document.querySelectorAll(CartUtils.selectors.quantityInputs);
      
      if (!updateBtn) return;

      this.enableButton(updateBtn);
      this.setupUpdateButtonHandler(updateBtn);
      this.setupQuantityChangeTracking(quantityInputs, updateBtn);
    },

    enableButton(button) {
      button.disabled = false;
      button.removeAttribute('disabled');
    },

    setupUpdateButtonHandler(updateBtn) {
      updateBtn.addEventListener('click', () => {
        if (!this.hasChanges) return;

        const hiddenInput = CartUtils.createHiddenInput('update_cart', 'Update cart');
        updateBtn.form.appendChild(hiddenInput);
        
        this.showCartLoading(updateBtn);
        setTimeout(() => updateBtn.form.submit(), 100);
      });
    },

    setupQuantityChangeTracking(inputs, updateBtn) {
      inputs.forEach((input) => {
        const originalValue = input.value;
        
        input.addEventListener('input', () => {
          const hasChanged = input.value !== originalValue;
          this.hasChanges = hasChanged;
          
          this.toggleButtonState(updateBtn, hasChanged);
        });
      });
    },

    toggleButtonState(button, enabled) {
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

    showCartLoading(btn) {
      this.updating = true;
      btn.disabled = true;
      btn.classList.add(...CartUtils.classes.loading);
      btn.innerHTML = `${CartUtils.createSpinner()}Updating...`;
    },

    autoHideNotices() {
      const notices = document.querySelectorAll(CartUtils.selectors.notices);
      
      notices.forEach(notice => {
        CartUtils.resetNoticeStyles(notice);
        CartUtils.fadeOutElement(notice);
      });
    },

    setupQuantityHandlers() {
      const quantityInputs = document.querySelectorAll(CartUtils.selectors.quantityInputs);
      
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
      const form = document.querySelector(CartUtils.selectors.cartForm);
      if (form) {
        this.updating = true;
        form.submit();
      }
    }
  }));

  Alpine.data("cartItem", () => ({
    removing: false,
    
    async removeItem() {
      if (!this.confirmRemoval()) return;

      this.removing = true;

      try {
        const removeUrl = this.getRemoveUrl();
        if (removeUrl) {
          window.location.href = removeUrl;
        } else {
          throw new Error('Remove URL not found');
        }
      } catch (error) {
        this.handleRemovalError(error);
      } finally {
        this.removing = false;
      }
    },

    confirmRemoval() {
      return confirm('Are you sure you want to remove this item from your cart?');
    },

    getRemoveUrl() {
      const removeLink = this.$el.querySelector(CartUtils.selectors.removeLink);
      return removeLink?.href;
    },

    handleRemovalError(error) {
      console.error('Error removing cart item:', error);
      alert('Failed to remove item. Please try again.');
    },

    get removeButtonClasses() {
      return {
        'opacity-50 cursor-not-allowed': this.removing,
        'hover:text-red-500': !this.removing
      };
    }
  }));
});