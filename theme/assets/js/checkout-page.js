document.addEventListener("alpine:init", () => {
  const CheckoutUtils = {
    selectors: {
      form: 'form.checkout',
      placeOrderBtn: '#place_order',
      shippingMethods: '.shipping_method',
      paymentMethods: '.payment_method',
      couponField: '#coupon_code',
      notices: '.woocommerce-message, .woocommerce-info, .woocommerce-error',
      reviewOrder: '.woocommerce-checkout-review-order'
    },

    classes: {
      loading: ['opacity-75', 'cursor-not-allowed'],
      disabled: ['opacity-50', 'pointer-events-none']
    },

    createSpinner() {
      return '<svg class="animate-spin h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24">' +
             '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
             '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
             '</svg>';
    }
  };

  Alpine.data("checkoutPage", () => ({
    processing: false,
    shipToDifferentAddress: false,
    selectedPaymentMethod: '',
    couponCode: '',

    init() {
      this.setupEventListeners();
      this.setupShippingHandlers();
      this.setupPaymentHandlers();
      this.setupFormValidation();
      this.initializeDefaultValues();
    },

    initializeDefaultValues() {
      // Initialize shipping address toggle
      const shipCheckbox = document.querySelector('#ship-to-different-address-checkbox');
      if (shipCheckbox) {
        this.shipToDifferentAddress = shipCheckbox.checked;
      }

      // Initialize selected payment method
      const selectedPayment = document.querySelector('.payment_method:checked');
      if (selectedPayment) {
        this.selectedPaymentMethod = selectedPayment.value;
        this.togglePaymentBox(selectedPayment.value, true);
      }
    },

    setupEventListeners() {
      // Form submission
      const form = document.querySelector(CheckoutUtils.selectors.form);
      if (form) {
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
      }

      // Country/state changes for field updates
      document.addEventListener('change', (e) => {
        if (e.target.matches('select[name*="country"], select[name*="state"]')) {
          this.updateCheckout();
        }
      });
    },

    setupShippingHandlers() {
      // Handle shipping method changes
      document.addEventListener('change', (e) => {
        if (e.target.matches('.shipping_method')) {
          this.updateShippingVisualState(e.target);
          this.handleShippingMethodChange(e.target);
        }
      });

      // Set initial visual state for any pre-selected shipping methods
      this.initializeShippingVisualState();

      // Update shipping when address fields change
      document.addEventListener('blur', (e) => {
        if (e.target.matches('input[name*="address"], input[name*="city"], input[name*="postcode"]')) {
          this.debouncedUpdateCheckout();
        }
      });
    },

    setupPaymentHandlers() {
      // Handle payment method changes
      document.addEventListener('change', (e) => {
        if (e.target.matches('.payment_method')) {
          const paymentMethod = e.target.value;
          this.selectedPaymentMethod = paymentMethod;
          this.togglePaymentBox(paymentMethod, true);
          this.updateCheckout();
        }
      });
    },

    setupFormValidation() {
      // Real-time validation feedback
      document.addEventListener('blur', (e) => {
        if (e.target.matches('input[required], select[required]')) {
          this.validateField(e.target);
        }
      });
    },

    async handleFormSubmit(e) {
      e.preventDefault();
      
      if (this.processing) return;
      
      this.processing = true;
      const form = e.target;
      const submitBtn = form.querySelector(CheckoutUtils.selectors.placeOrderBtn);
      
      // Show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add(...CheckoutUtils.classes.loading);
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = `${CheckoutUtils.createSpinner()}Processing Order...`;
      }

      try {
        // Validate form before submission
        if (!this.validateForm(form)) {
          throw new Error('Please fill in all required fields correctly.');
        }

        // Submit form via AJAX
        const formData = new FormData(form);
        const response = await fetch(form.action || window.location.href, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          const result = await response.text();
          
          // Check if the response contains a redirect or success
          if (result.includes('woocommerce-order-received') || result.includes('order-received')) {
            // Redirect to thank you page
            const parser = new DOMParser();
            const doc = parser.parseFromString(result, 'text/html');
            const redirectUrl = doc.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content');
            
            if (redirectUrl) {
              const url = redirectUrl.split('url=')[1];
              window.location.href = url;
            } else {
              // Fallback: try to extract order received URL
              const orderReceivedLink = doc.querySelector('a[href*="order-received"]');
              if (orderReceivedLink) {
                window.location.href = orderReceivedLink.href;
              } else {
                window.location.reload();
              }
            }
          } else {
            // Handle errors or update checkout
            this.handleCheckoutResponse(result);
          }
        } else {
          throw new Error('Network error occurred. Please try again.');
        }

      } catch (error) {
        console.error('Checkout error:', error);
        this.showError(error.message);
      } finally {
        this.processing = false;
        
        // Reset submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove(...CheckoutUtils.classes.loading);
          submitBtn.innerHTML = submitBtn.getAttribute('data-value') || 'Place Order';
        }
      }
    },

    async handleShippingMethodChange(target) {
      const reviewOrder = document.querySelector(CheckoutUtils.selectors.reviewOrder);
      
      // Show loading state
      if (reviewOrder) {
        reviewOrder.style.opacity = '0.6';
        reviewOrder.style.pointerEvents = 'none';
      }

      try {
        const shippingMethods = {};
        document.querySelectorAll('.shipping_method:checked, .shipping_method[type="hidden"]').forEach(input => {
          const index = input.getAttribute('data-index') || '0';
          shippingMethods[index] = input.value;
        });

        // Update shipping method via AJAX
        await this.updateShippingMethod(shippingMethods);

      } catch (error) {
        console.error('Error updating shipping method:', error);
      } finally {
        // Remove loading state
        if (reviewOrder) {
          reviewOrder.style.opacity = '';
          reviewOrder.style.pointerEvents = '';
        }
      }
    },

    async updateShippingMethod(shippingMethods) {
      console.log('Updating shipping method:', shippingMethods);
      
      // Collect form data for proper checkout update
      const form = document.querySelector(CheckoutUtils.selectors.form);
      if (!form) {
        console.error('Checkout form not found');
        return;
      }

      const formData = new FormData(form);
      
      // Override shipping methods in form data
      Object.keys(shippingMethods).forEach(index => {
        formData.set(`shipping_method[${index}]`, shippingMethods[index]);
      });

      // Add security nonce and action
      formData.set('security', window.wc_checkout_params?.update_order_review_nonce || '');
      formData.set('action', 'woocommerce_update_order_review');

      // Also add it as URL parameter for compatibility
      const ajaxUrl = window.wc_checkout_params?.wc_ajax_url?.replace('%%endpoint%%', 'update_order_review') || 
                      '/wp-admin/admin-ajax.php?action=woocommerce_update_order_review';

      console.log('Making request to:', ajaxUrl);

      try {
        const response = await fetch(ajaxUrl, {
          method: 'POST',
          credentials: 'same-origin',
          body: formData
        });

        console.log('Response status:', response.status);

        if (response.ok) {
          const result = await response.json();
          console.log('Update result:', result);
          
          // Handle both fragments and HTML response
          if (result.fragments) {
            this.updateCheckoutFragments(result);
          } else if (result.result) {
            this.handleCheckoutResponse(result.result);
          } else if (result.html) {
            this.handleCheckoutResponse(result.html);
          } else {
            // Fallback: trigger full checkout update
            this.updateCheckout();
          }
        } else {
          console.error('Failed to update shipping method:', response.statusText);
          // Fallback: trigger full checkout update
          this.updateCheckout();
        }
      } catch (error) {
        console.error('Error updating shipping method:', error);
        // Fallback: trigger full checkout update
        this.updateCheckout();
      }
    },

    async applyCoupon() {
      if (!this.couponCode.trim()) {
        this.showError('Please enter a coupon code.');
        return;
      }

      try {
        const formData = new FormData();
        formData.append('coupon_code', this.couponCode);
        formData.append('security', window.wc_checkout_params?.apply_coupon_nonce || '');

        const response = await fetch(window.wc_checkout_params?.wc_ajax_url?.replace('%%endpoint%%', 'apply_coupon') || '/wp-admin/admin-ajax.php?action=woocommerce_apply_coupon', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          this.updateCheckout();
          this.couponCode = '';
        }

      } catch (error) {
        console.error('Error applying coupon:', error);
        this.showError('Failed to apply coupon. Please try again.');
      }
    },

    togglePaymentBox(paymentMethod, show) {
      // Hide all payment boxes
      document.querySelectorAll('.payment-box').forEach(box => {
        box.style.display = 'none';
      });

      // Show selected payment box
      if (show) {
        const targetBox = document.querySelector(`#payment_method_${paymentMethod}`);
        if (targetBox) {
          const paymentBox = targetBox.closest('.payment-method-option')?.querySelector('.payment-box');
          if (paymentBox) {
            paymentBox.style.display = 'block';
          }
        }
      }
    },

    async updateCheckout() {
      console.log('Updating checkout...');
      
      try {
        const form = document.querySelector(CheckoutUtils.selectors.form);
        if (!form) {
          console.error('Checkout form not found for update');
          return;
        }

        const formData = new FormData(form);
        formData.set('action', 'woocommerce_update_order_review');
        formData.set('security', window.wc_checkout_params?.update_order_review_nonce || '');
        
        const ajaxUrl = window.wc_checkout_params?.wc_ajax_url?.replace('%%endpoint%%', 'update_order_review') || 
                        '/wp-admin/admin-ajax.php?action=woocommerce_update_order_review';

        const response = await fetch(ajaxUrl, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        });

        console.log('Checkout update response status:', response.status);

        if (response.ok) {
          const result = await response.json();
          console.log('Checkout update result:', result);
          
          if (result.fragments || result.result) {
            this.updateCheckoutFragments(result);
          } else {
            console.warn('No fragments in checkout update response');
          }
        } else {
          console.error('Checkout update failed:', response.statusText);
        }

      } catch (error) {
        console.error('Error updating checkout:', error);
      }
    },

    debouncedUpdateCheckout: (() => {
      let timeout;
      return function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.updateCheckout(), 1000);
      };
    })(),

    updateCheckoutFragments(data) {
      console.log('Updating checkout fragments:', data);
      
      if (data.fragments) {
        Object.keys(data.fragments).forEach(selector => {
          console.log('Processing fragment selector:', selector);
          const element = document.querySelector(selector);
          if (element) {
            console.log('Found element for selector:', selector);
            element.innerHTML = data.fragments[selector];
          } else {
            console.log('Element not found for selector:', selector);
            
            // Handle specific WooCommerce fragments that don't match our custom structure
            if (selector === '.woocommerce-checkout-review-order-table') {
              // Update our custom order summary instead
              const orderSummary = document.querySelector('.order-summary');
              if (orderSummary) {
                console.log('Updating custom order summary with table fragment');
                // Extract and update just the totals part
                this.updateOrderSummaryFromTable(data.fragments[selector], orderSummary);
              }
            } else if (selector === '.woocommerce-checkout-payment') {
              // Update payment methods if we have them
              const paymentSection = document.querySelector('.payment-methods-section');
              if (paymentSection) {
                console.log('Updating payment section');
                // For now, just log - payment methods update may not be needed
              }
            }
          }
        });
      }

      // Also update the order review area if we have result HTML
      if (data.result || data.html) {
        this.handleCheckoutResponse(data.result || data.html);
      }

      // Re-initialize shipping visual state after fragments update
      this.initializeShippingVisualState();

      // Trigger checkout updated event
      document.dispatchEvent(new CustomEvent('checkout_updated', {
        detail: { fragments: data.fragments }
      }));
    },

    handleCheckoutResponse(html) {
      console.log('Handling checkout response...');
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Update notices
      const notices = doc.querySelectorAll(CheckoutUtils.selectors.notices);
      if (notices.length > 0) {
        this.displayNotices(notices);
      }

      // Update checkout review/order summary if present
      const newReviewOrder = doc.querySelector(CheckoutUtils.selectors.reviewOrder);
      const currentReviewOrder = document.querySelector(CheckoutUtils.selectors.reviewOrder);
      
      if (newReviewOrder && currentReviewOrder) {
        console.log('Updating order review area');
        currentReviewOrder.innerHTML = newReviewOrder.innerHTML;
        
        // Re-initialize Alpine.js for the updated content
        if (window.Alpine) {
          Alpine.initTree(currentReviewOrder);
        }
      } else {
        console.warn('Could not find order review elements');
        
        // Fallback: try to update order summary specifically
        const newOrderSummary = doc.querySelector('.order-summary');
        const currentOrderSummary = document.querySelector('.order-summary');
        
        if (newOrderSummary && currentOrderSummary) {
          console.log('Updating order summary as fallback');
          currentOrderSummary.innerHTML = newOrderSummary.innerHTML;
          
          // Re-initialize Alpine.js for the updated content
          if (window.Alpine) {
            Alpine.initTree(currentOrderSummary);
          }
        }
      }

      // Re-initialize shipping visual state after content update
      this.initializeShippingVisualState();
    },

    validateForm(form) {
      const requiredFields = form.querySelectorAll('input[required], select[required]');
      let isValid = true;

      requiredFields.forEach(field => {
        if (!this.validateField(field)) {
          isValid = false;
        }
      });

      return isValid;
    },

    validateField(field) {
      const isValid = field.checkValidity();
      
      // Visual feedback
      if (isValid) {
        field.classList.remove('border-red-500', 'focus:border-red-500');
        field.classList.add('border-gray-300', 'focus:border-blue-500');
      } else {
        field.classList.remove('border-gray-300', 'focus:border-blue-500');
        field.classList.add('border-red-500', 'focus:border-red-500');
      }

      return isValid;
    },

    displayNotices(notices) {
      // Remove existing notices
      document.querySelectorAll(CheckoutUtils.selectors.notices).forEach(notice => {
        notice.remove();
      });

      // Add new notices
      const form = document.querySelector(CheckoutUtils.selectors.form);
      if (form && notices.length > 0) {
        notices.forEach(notice => {
          form.insertBefore(notice.cloneNode(true), form.firstChild);
        });
      }
    },

    showError(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'woocommerce-error bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4';
      errorDiv.textContent = message;

      const form = document.querySelector(CheckoutUtils.selectors.form);
      if (form) {
        form.insertBefore(errorDiv, form.firstChild);
        errorDiv.scrollIntoView({ behavior: 'smooth' });
      }
    },

    updateOrderSummaryFromTable(tableHtml, orderSummary) {
      console.log('Updating order summary from WooCommerce table');
      
      // Parse the table HTML to extract totals
      const parser = new DOMParser();
      const doc = parser.parseFromString(tableHtml, 'text/html');
      const table = doc.querySelector('table');
      
      if (!table) {
        console.warn('No table found in fragment');
        return;
      }

      // Extract shipping cost and total from the table
      const tableRows = table.querySelectorAll('tr');
      let shippingCost = null;
      let totalCost = null;

      tableRows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim().toLowerCase();
          const value = cells[1].innerHTML.trim();
          
          if (label.includes('shipping') || label.includes('delivery')) {
            shippingCost = value;
          } else if (label.includes('total')) {
            totalCost = value;
          }
        }
      });

      // Update total cost in our custom order summary
      const totalRow = orderSummary.querySelector('.total-row:last-child');
      if (totalRow && totalCost) {
        const totalPriceElement = totalRow.querySelector('span:last-child');
        if (totalPriceElement) {
          console.log('Updating total cost:', totalCost);
          totalPriceElement.innerHTML = totalCost;
        }
      }

      // Also look for the specific "Total (inc GST)" row
      const summaryRows = orderSummary.querySelectorAll('.total-row');
      summaryRows.forEach(row => {
        const label = row.querySelector('span:first-child');
        const price = row.querySelector('span:last-child');
        if (label && price && label.textContent.includes('Total') && totalCost) {
          console.log('Updating total in row:', label.textContent, 'with:', totalCost);
          price.innerHTML = totalCost;
        }
      });
    },

    initializeShippingVisualState() {
      // Set initial visual state for any pre-selected shipping methods
      const shippingInputs = document.querySelectorAll('input[name^="shipping_method"]');
      shippingInputs.forEach(input => {
        if (input.checked) {
          this.updateShippingVisualState(input);
        }
      });
    },

    updateShippingVisualState(changedInput) {
      // Get the package index for this input
      const packageIndex = changedInput.getAttribute('data-index') || '0';
      
      // Find all shipping method inputs for the same package
      const packageInputs = document.querySelectorAll(`input[name^="shipping_method"][data-index="${packageIndex}"]`);
      
      packageInputs.forEach(input => {
        const label = input.closest('.shipping-method-option')?.querySelector('.shipping-method-label');
        const radioButton = label?.querySelector('.radio-button');
        const radioInner = label?.querySelector('.radio-inner');
        
        if (label && radioButton && radioInner) {
          if (input === changedInput && input.checked) {
            // Selected state - only update radio button
            radioButton.classList.add('border-black');
            radioButton.classList.remove('border-gray-300');
            radioInner.classList.add('scale-100');
            radioInner.classList.remove('scale-0');
          } else {
            // Unselected state - only update radio button
            radioButton.classList.remove('border-black');
            radioButton.classList.add('border-gray-300');
            radioInner.classList.remove('scale-100');
            radioInner.classList.add('scale-0');
          }
        }
      });
    }
  }));
});