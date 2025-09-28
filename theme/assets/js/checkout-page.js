document.addEventListener("alpine:init", () => {
  const CheckoutUtils = {
    selectors: {
      form: "form.checkout",
      placeOrderBtn: "#place_order",
      shippingMethods: ".shipping_method",
      paymentMethods: ".payment_method",
      couponField: "#coupon_code",
      notices: ".woocommerce-message, .woocommerce-info, .woocommerce-error",
      reviewOrder: ".woocommerce-checkout-review-order",
    },

    classes: {
      loading: ["opacity-75", "cursor-not-allowed"],
      disabled: ["opacity-50", "pointer-events-none"],
    },

    createSpinner() {
      return (
        '<svg class="animate-spin h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24">' +
        '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
        "</svg>"
      );
    },
  };

  Alpine.data("checkoutPage", () => ({
    processing: false,
    shipToDifferentAddress: false,
    selectedPaymentMethod: "",
    couponCode: "",
    isUpdating: false,
    shippingUpdateTimeout: null,
    lastUpdateId: null,

    init() {
      // Store instance globally for debugging and direct access
      window.checkoutPageInstance = this;

      this.setupEventListeners();
      this.setupShippingHandlers();
      this.setupPaymentHandlers();
      this.setupFormValidation();
      this.initializeDefaultValues();
      this.setupShippingCalculatorIntegration();
      this.checkAndRefreshShippingOnLoad();
    },

    initializeDefaultValues() {
      // Initialize shipping address toggle
      const shipCheckbox = document.querySelector(
        "#ship-to-different-address-checkbox"
      );
      if (shipCheckbox) {
        this.shipToDifferentAddress = shipCheckbox.checked;
      }

      // Initialize selected payment method
      const selectedPayment = document.querySelector(".payment_method:checked");
      if (selectedPayment) {
        this.selectedPaymentMethod = selectedPayment.value;
        this.togglePaymentBox(selectedPayment.value, true);
      }
    },

    setupEventListeners() {
      // Form submission
      const form = document.querySelector(CheckoutUtils.selectors.form);
      if (form) {
        form.addEventListener("submit", (e) => this.handleFormSubmit(e));
      }

      // Country/state changes for field updates
      document.addEventListener("change", (e) => {
        if (
          e.target.matches('select[name*="country"], select[name*="state"]')
        ) {
          this.updateCheckout();
        }
      });

      // Listen for all checkout field changes that might affect shipping
      document.addEventListener("change", (e) => {
        if (
          e.target.matches(
            'select[name="billing_country"], select[name="billing_state"], ' +
            'select[name="shipping_country"], select[name="shipping_state"]'
          )
        ) {
          this.debouncedUpdateCheckout();
        }
      });
    },

    setupShippingHandlers() {
      // Handle shipping method changes
      document.addEventListener("change", (e) => {
        if (e.target.matches(".shipping_method")) {
          this.updateShippingVisualState(e.target);
          this.handleShippingMethodChange(e.target);
        }
      });

      // Set initial visual state for any pre-selected shipping methods
      this.initializeShippingVisualState();

      // Update shipping when address fields change
      document.addEventListener("blur", (e) => {
        if (
          e.target.matches(
            'input[name="billing_address_1"], input[name="billing_address_2"], input[name="billing_city"], input[name="billing_postcode"], input[name="billing_state"], ' +
            'input[name="shipping_address_1"], input[name="shipping_address_2"], input[name="shipping_city"], input[name="shipping_postcode"], input[name="shipping_state"]'
          )
        ) {
          this.debouncedUpdateCheckout();
        }
      });

      // Real-time updates for postcode changes (both billing and shipping)
      document.addEventListener("input", (e) => {
        if (e.target.matches('input[name="billing_postcode"], input[name="shipping_postcode"]')) {
          this.debouncedUpdateCheckoutFast();
        }
      });

      // Generic billing/shipping field listener (fallback for any missed fields)
      document.addEventListener("change", (e) => {
        if (e.target.name && (e.target.name.startsWith('billing_') || e.target.name.startsWith('shipping_'))) {
          this.debouncedUpdateCheckout();
        }
      });
    },

    setupPaymentHandlers() {
      // Handle payment method changes
      document.addEventListener("change", (e) => {
        if (e.target.matches(".payment_method")) {
          const paymentMethod = e.target.value;
          this.selectedPaymentMethod = paymentMethod;
          this.togglePaymentBox(paymentMethod, true);
          this.updateCheckout();
        }
      });
    },

    setupFormValidation() {
      // Real-time validation feedback
      document.addEventListener("blur", (e) => {
        if (e.target.matches("input[required], select[required]")) {
          this.validateField(e.target);
        }
      });
    },

    async handleFormSubmit(e) {
      e.preventDefault();

      if (this.processing) return;

      this.processing = true;
      const form = e.target;
      const submitBtn = form.querySelector(
        CheckoutUtils.selectors.placeOrderBtn
      );

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
          throw new Error("Please fill in all required fields correctly.");
        }

        // Submit form via AJAX
        const formData = new FormData(form);
        const response = await fetch(form.action || window.location.href, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });

        if (response.ok) {
          const result = await response.text();

          // Check if the response contains a redirect or success
          if (
            result.includes("woocommerce-order-received") ||
            result.includes("order-received")
          ) {
            // Redirect to thank you page
            const parser = new DOMParser();
            const doc = parser.parseFromString(result, "text/html");
            const redirectUrl = doc
              .querySelector('meta[http-equiv="refresh"]')
              ?.getAttribute("content");

            if (redirectUrl) {
              const url = redirectUrl.split("url=")[1];
              window.location.href = url;
            } else {
              // Fallback: try to extract order received URL
              const orderReceivedLink = doc.querySelector(
                'a[href*="order-received"]'
              );
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
          throw new Error("Network error occurred. Please try again.");
        }
      } catch (error) {
        console.error("Checkout error:", error);
        this.showError(error.message);
      } finally {
        this.processing = false;

        // Reset submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove(...CheckoutUtils.classes.loading);
          submitBtn.innerHTML =
            submitBtn.getAttribute("data-value") || "Place Order";
        }
      }
    },

    async handleShippingMethodChange(target) {
      // Don't trigger update if we're already updating (prevents loops)
      if (this.isUpdating) {
        return;
      }

      // Clear any existing timeout
      if (this.shippingUpdateTimeout) {
        clearTimeout(this.shippingUpdateTimeout);
      }

      // Debounce the update to prevent rapid consecutive calls
      this.shippingUpdateTimeout = setTimeout(async () => {
        const reviewOrder = document.querySelector(
          CheckoutUtils.selectors.reviewOrder
        );

        // Show loading state
        if (reviewOrder) {
          reviewOrder.style.opacity = "0.6";
          reviewOrder.style.pointerEvents = "none";
        }

        try {
          // Simply trigger the standard WooCommerce checkout update
          // This is more reliable than trying to update just shipping methods
          await this.updateCheckout();
        } catch (error) {
          console.error("Error updating shipping method:", error);
        } finally {
          // Remove loading state
          if (reviewOrder) {
            reviewOrder.style.opacity = "";
            reviewOrder.style.pointerEvents = "";
          }
        }
      }, 300); // 300ms debounce
    },

    async applyCoupon() {
      if (!this.couponCode.trim()) {
        this.showError("Please enter a coupon code.");
        return;
      }

      try {
        const formData = new FormData();
        formData.append("coupon_code", this.couponCode);
        formData.append(
          "security",
          window.wc_checkout_params?.apply_coupon_nonce || ""
        );

        const ajaxUrl =
          window.wc_checkout_params?.wc_ajax_url?.replace(
            "%%endpoint%%",
            "apply_coupon"
          ) || "/wp-admin/admin-ajax.php?action=woocommerce_apply_coupon";

        const response = await fetch(ajaxUrl, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            // Handle JSON response from our custom handler
            const result = await response.json();

            if (result.success) {
              this.updateCheckout();
              this.couponCode = "";
              // Update applied coupons display
              setTimeout(() => {
                this.updateAppliedCoupons();
              }, 1000);
            } else {
              // Show error message from server
              this.showError(result.data || "Failed to apply coupon.");
            }
          } else {
            // Handle HTML response from WooCommerce default handler
            const result = await response.text();

            if (result.includes("woocommerce-error")) {
              // Extract error message and show it
              const parser = new DOMParser();
              const doc = parser.parseFromString(result, "text/html");
              const errorElement = doc.querySelector(".woocommerce-error");
              const errorMessage = errorElement
                ? errorElement.textContent.trim()
                : "Invalid coupon code.";
              this.showError(errorMessage);
            } else {
              this.updateCheckout();
              this.couponCode = "";
              // Update applied coupons display
              setTimeout(() => {
                this.updateAppliedCoupons();
              }, 1000);
            }
          }
        } else {
          this.showError("Failed to apply coupon. Please try again.");
        }
      } catch (error) {
        this.showError("Failed to apply coupon. Please try again.");
      }
    },

    async removeCoupon(couponCode) {
      if (!couponCode) {
        return;
      }

      try {
        const formData = new FormData();
        formData.append("coupon_code", couponCode);
        formData.append(
          "security",
          window.wc_checkout_params?.remove_coupon_nonce || ""
        );

        const ajaxUrl =
          window.wc_checkout_params?.wc_ajax_url?.replace(
            "%%endpoint%%",
            "remove_coupon"
          ) || "/wp-admin/admin-ajax.php?action=woocommerce_remove_coupon";

        const response = await fetch(ajaxUrl, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });

        if (response.ok) {
          this.updateCheckout();
          // Update applied coupons display
          setTimeout(() => {
            this.updateAppliedCoupons();
          }, 500);
        } else {
          this.showError("Failed to remove coupon. Please try again.");
        }
      } catch (error) {
        this.showError("Failed to remove coupon. Please try again.");
      }
    },

    togglePaymentBox(paymentMethod, show) {
      // Hide all payment boxes
      document.querySelectorAll(".payment-box").forEach((box) => {
        box.style.display = "none";
      });

      // Show selected payment box
      if (show) {
        const targetBox = document.querySelector(
          `#payment_method_${paymentMethod}`
        );
        if (targetBox) {
          const paymentBox = targetBox
            .closest(".payment-method-option")
            ?.querySelector(".payment-box");
          if (paymentBox) {
            paymentBox.style.display = "block";
          }
        }
      }
    },

    async updateCheckout() {
      // Prevent rapid consecutive calls
      if (this.isUpdating) {
        return;
      }

      // Set flag immediately and keep it set longer to prevent cascading calls
      this.isUpdating = true;

      try {
        // Show loading state
        this.showCheckoutLoadingState(true);

        // Use the manual refresh approach directly since it's reliable
        await this.manualRefreshOrderSummary();

        // Keep the flag set for a brief period to prevent immediate re-triggers
        setTimeout(() => {
          this.isUpdating = false;
        }, 500);

      } catch (error) {
        console.error('updateCheckout error:', error);
        this.isUpdating = false;
      } finally {
        // Remove loading state
        this.showCheckoutLoadingState(false);
      }
    },

    async manualRefreshOrderSummary() {
      // Create unique execution ID for this call
      const updateId = Date.now() + Math.random();

      // Check if this is a duplicate call
      if (this.lastUpdateId && (updateId - this.lastUpdateId) < 1000) {
        return;
      }

      this.lastUpdateId = updateId;

      try {
        // Fetch the current checkout page to get updated totals
        const response = await fetch(window.location.href, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (response.ok) {
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Update the order summary section
          const currentOrderSummary = document.querySelector('.order-summary');
          const newOrderSummary = doc.querySelector('.order-summary');

          if (currentOrderSummary && newOrderSummary) {
            // Temporarily disable update to prevent loops during refresh
            const wasUpdating = this.isUpdating;
            this.isUpdating = true;

            currentOrderSummary.innerHTML = newOrderSummary.innerHTML;

            // Re-initialize Alpine.js for the updated content (but disable event handling temporarily)
            if (window.Alpine) {
              Alpine.initTree(currentOrderSummary);
            }

            // Re-initialize shipping visual state (but don't trigger updates)
            this.initializeShippingVisualState();

            // Restore update state
            this.isUpdating = wasUpdating;
          }
        }
      } catch (error) {
        console.error('Manual refresh failed:', error);
      }
    },

    debouncedUpdateCheckout: (() => {
      let timeout;
      return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.updateCheckout(), 1000);
      };
    })(),

    debouncedUpdateCheckoutFast: (() => {
      let timeout;
      return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.updateCheckout(), 500);
      };
    })(),

    updateCheckoutFragments(data) {
      if (data.fragments) {
        Object.keys(data.fragments).forEach((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.innerHTML = data.fragments[selector];
          } else {
            // Handle specific WooCommerce fragments that don't match our custom structure
            if (selector === ".woocommerce-checkout-review-order-table") {
              // Update our custom order summary instead
              const orderSummary = document.querySelector(".order-summary");
              if (orderSummary) {
                // Extract and update shipping and totals
                this.updateCustomOrderSummaryFromWooCommerceTable(
                  data.fragments[selector],
                  orderSummary
                );

                // Refresh the shipping methods section like the cart does
                this.refreshShippingMethodsSection();
              }
            }

            // Handle payment methods
            if (selector === ".woocommerce-checkout-payment") {
              const paymentSection = document.querySelector(".payment-methods, [data-payment-methods]");
              if (paymentSection) {
                // Extract just the payment methods part
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.fragments[selector], 'text/html');
                const paymentMethods = doc.querySelector('.wc_payment_methods, .payment_methods');
                if (paymentMethods) {
                  paymentSection.innerHTML = paymentMethods.innerHTML;
                }
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
      document.dispatchEvent(
        new CustomEvent("checkout_updated", {
          detail: { fragments: data.fragments },
        })
      );
    },

    handleCheckoutResponse(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Update notices
      const notices = doc.querySelectorAll(CheckoutUtils.selectors.notices);
      if (notices.length > 0) {
        this.displayNotices(notices);
      }

      // Update checkout review/order summary if present
      const newReviewOrder = doc.querySelector(
        CheckoutUtils.selectors.reviewOrder
      );
      const currentReviewOrder = document.querySelector(
        CheckoutUtils.selectors.reviewOrder
      );

      if (newReviewOrder && currentReviewOrder) {
        currentReviewOrder.innerHTML = newReviewOrder.innerHTML;

        // Re-initialize Alpine.js for the updated content
        if (window.Alpine) {
          Alpine.initTree(currentReviewOrder);
        }
      } else {
        // Fallback: try to update order summary specifically
        const newOrderSummary = doc.querySelector(".order-summary");
        const currentOrderSummary = document.querySelector(".order-summary");

        if (newOrderSummary && currentOrderSummary) {
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

    setupShippingCalculatorIntegration() {
      // If shipping calculator is available on checkout page, integrate it with checkout updates
      if (window.ShippingCalculator) {
        // Store reference to this context
        const checkoutComponent = this;

        // Override the shipping calculator's update method to use checkout's update function
        window.ShippingCalculator.updateShippingAddress = async function(form) {
          const submitButton = form.querySelector('button[type="submit"]');
          const originalText = submitButton.textContent;

          // Show loading state
          submitButton.disabled = true;
          submitButton.textContent = 'Updating...';

          // Get form data and update checkout form fields
          const formData = new FormData(form);
          const country = formData.get('shipping_country');
          const state = formData.get('shipping_state');
          const city = formData.get('shipping_city');
          const postcode = formData.get('shipping_postcode');

          try {
            // Update the actual checkout form fields
            checkoutComponent.updateCheckoutFormFields(country, state, city, postcode);

            // Trigger checkout update
            await checkoutComponent.updateCheckout();

            // Hide the shipping calculator form
            const formContainer = document.querySelector('#custom-shipping-form');
            const toggleButton = document.querySelector('.shipping-address-toggle');

            if (formContainer) {
              formContainer.classList.add('hidden');
            }
            if (toggleButton) {
              toggleButton.setAttribute('aria-expanded', 'false');
            }
          } catch (error) {
            console.error('Error updating shipping address:', error);
            window.ShippingCalculator.showShippingError('Failed to update shipping address. Please try again.');
          } finally {
            // Reset button
            submitButton.disabled = false;
            submitButton.textContent = originalText;
          }
        };
      }
    },

    updateCheckoutFormFields(country, state, city, postcode) {
      // Update shipping fields in the checkout form
      const shippingCountry = document.querySelector('select[name="shipping_country"]');
      const shippingState = document.querySelector('select[name="shipping_state"], input[name="shipping_state"]');
      const shippingCity = document.querySelector('input[name="shipping_city"]');
      const shippingPostcode = document.querySelector('input[name="shipping_postcode"]');

      if (shippingCountry && country) shippingCountry.value = country;
      if (shippingState && state) shippingState.value = state;
      if (shippingCity && city) shippingCity.value = city;
      if (shippingPostcode && postcode) shippingPostcode.value = postcode;

      // Also update billing fields if "ship to different address" is not checked
      const shipToDifferent = document.querySelector('#ship-to-different-address-checkbox');
      if (!shipToDifferent || !shipToDifferent.checked) {
        const billingCountry = document.querySelector('select[name="billing_country"]');
        const billingState = document.querySelector('select[name="billing_state"], input[name="billing_state"]');
        const billingCity = document.querySelector('input[name="billing_city"]');
        const billingPostcode = document.querySelector('input[name="billing_postcode"]');

        if (billingCountry && country) billingCountry.value = country;
        if (billingState && state) billingState.value = state;
        if (billingCity && city) billingCity.value = city;
        if (billingPostcode && postcode) billingPostcode.value = postcode;
      }
    },

    validateForm(form) {
      const requiredFields = form.querySelectorAll(
        "input[required], select[required]"
      );
      let isValid = true;

      requiredFields.forEach((field) => {
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
        field.classList.remove("border-red-500", "focus:border-red-500");
        field.classList.add("border-gray-300", "focus:border-blue-500");
      } else {
        field.classList.remove("border-gray-300", "focus:border-blue-500");
        field.classList.add("border-red-500", "focus:border-red-500");
      }

      return isValid;
    },

    displayNotices(notices) {
      // Remove existing notices
      document
        .querySelectorAll(CheckoutUtils.selectors.notices)
        .forEach((notice) => {
          notice.remove();
        });

      // Add new notices
      const form = document.querySelector(CheckoutUtils.selectors.form);
      if (form && notices.length > 0) {
        notices.forEach((notice) => {
          form.insertBefore(notice.cloneNode(true), form.firstChild);
        });
      }
    },

    showError(message) {
      // Remove any existing error messages first
      const existingErrors = document.querySelectorAll(".coupon-error-message");
      existingErrors.forEach((error) => error.remove());

      const errorDiv = document.createElement("div");
      errorDiv.className =
        "coupon-error-message woocommerce-error bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4 relative";

      // Add close button
      errorDiv.innerHTML = `
        <div class="flex justify-between items-center">
          <span>${message}</span>
          <button type="button" class="ml-4 text-red-600 hover:text-red-800" onclick="this.parentElement.parentElement.remove()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      `;

      const form = document.querySelector(CheckoutUtils.selectors.form);
      if (form) {
        form.insertBefore(errorDiv, form.firstChild);
        errorDiv.scrollIntoView({ behavior: "smooth" });

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.style.transition = "opacity 0.5s ease-out";
            errorDiv.style.opacity = "0";
            setTimeout(() => {
              if (errorDiv.parentNode) {
                errorDiv.remove();
              }
            }, 500);
          }
        }, 5000);
      }
    },

    updateCustomOrderSummaryFromWooCommerceTable(tableHtml, orderSummary) {
      // Parse the table HTML to extract data
      const parser = new DOMParser();
      const doc = parser.parseFromString(tableHtml, "text/html");
      const table = doc.querySelector("table");

      if (!table) {
        return;
      }

      // Extract all data from the table
      const tableRows = table.querySelectorAll("tr");
      let subtotal = null;
      let shipping = null;
      let total = null;
      let shippingMethods = [];

      tableRows.forEach((row) => {
        const label = row.querySelector(".product-name, th");
        const value = row.querySelector(".product-total, td:last-child");

        if (!label || !value) return;

        const labelText = label.textContent.trim().toLowerCase();
        const valueHtml = value.innerHTML.trim();

        if (labelText.includes("subtotal")) {
          subtotal = valueHtml;
        } else if (labelText.includes("shipping")) {
          shipping = valueHtml;

          // Extract shipping methods if present
          const shippingInputs = row.querySelectorAll('input[name^="shipping_method"]');
          shippingInputs.forEach(input => {
            shippingMethods.push({
              id: input.value,
              checked: input.checked,
              label: input.nextElementSibling?.textContent || '',
              html: row.innerHTML
            });
          });
        } else if (labelText.includes("total")) {
          total = valueHtml;
        }
      });

      // Update subtotal
      if (subtotal) {
        const totalRows = orderSummary.querySelectorAll('.total-row');
        totalRows.forEach((row) => {
          const label = row.querySelector("span:first-child");
          if (label && label.textContent.toLowerCase().includes("subtotal")) {
            const priceElement = row.querySelector("span:last-child");
            if (priceElement) {
              priceElement.innerHTML = subtotal;
            }
          }
        });
      }

      // Update shipping section if we have shipping methods
      if (shippingMethods.length > 0) {
        const shippingSection = orderSummary.querySelector('.shipping-section');
        if (shippingSection) {
          // Update shipping methods in our custom structure
          this.updateShippingMethodsInOrderSummary(shippingMethods, shippingSection);
        }
      }

      // Update total
      if (total) {
        const totalRows = orderSummary.querySelectorAll('.total-row');
        totalRows.forEach((row) => {
          const label = row.querySelector("span:first-child");
          const price = row.querySelector("span:last-child");
          if (label && price && label.textContent.toLowerCase().includes("total")) {
            price.innerHTML = total;
          }
        });
      }
    },

    updateShippingMethodsInOrderSummary(shippingMethods, shippingSection) {
      // This will update the shipping methods in the order summary

      // Find and update any existing shipping cost display
      const orderSummary = shippingSection.closest('.order-summary');
      if (orderSummary && shippingMethods.length > 0) {
        const selectedMethod = shippingMethods.find(m => m.checked);
        if (selectedMethod) {
          // Look for shipping row in order totals
          const totalRows = orderSummary.querySelectorAll('.total-row');
          totalRows.forEach((row) => {
            const label = row.querySelector("span:first-child");
            if (label && label.textContent.toLowerCase().includes("shipping")) {
              const priceElement = row.querySelector("span:last-child");
              if (priceElement) {
                // Extract price from the method label
                const priceMatch = selectedMethod.label.match(/\$[\d,]+\.?\d*/);
                if (priceMatch) {
                  priceElement.textContent = priceMatch[0];
                }
              }
            }
          });
        }
      }
    },

    async refreshShippingMethodsSection() {
      try {
        // Fetch fresh checkout page content
        const response = await fetch(window.location.href, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (!response.ok) {
          return;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Update the shipping section in the order summary
        const currentShippingSection = document.querySelector('.order-summary .shipping-section');
        const newShippingSection = doc.querySelector('.order-summary .shipping-section');

        if (currentShippingSection && newShippingSection) {
          currentShippingSection.innerHTML = newShippingSection.innerHTML;

          // Reinitialize Alpine.js components for the updated content
          if (window.Alpine) {
            Alpine.initTree(currentShippingSection);
          }

          // Re-initialize shipping visual state
          this.initializeShippingVisualState();
        }

      } catch (error) {
        // Silent fail
      }
    },

    showCheckoutLoadingState(show) {
      const orderSummary = document.querySelector('.order-summary');
      const placeOrderBtn = document.querySelector(CheckoutUtils.selectors.placeOrderBtn);
      const shippingSection = document.querySelector('.order-summary .shipping-section');

      if (show) {
        // Disable place order button
        if (placeOrderBtn) {
          placeOrderBtn.disabled = true;
          placeOrderBtn.classList.add(...CheckoutUtils.classes.disabled);
          placeOrderBtn.setAttribute('data-original-text', placeOrderBtn.textContent);
          placeOrderBtn.textContent = 'Updating...';
        }

        // Add loading state to order summary
        if (orderSummary) {
          orderSummary.classList.add(...CheckoutUtils.classes.disabled);
        }

        // Add loading state to shipping section
        if (shippingSection) {
          shippingSection.style.opacity = '0.6';
          shippingSection.style.pointerEvents = 'none';
        }
      } else {
        // Re-enable place order button
        if (placeOrderBtn) {
          placeOrderBtn.disabled = false;
          placeOrderBtn.classList.remove(...CheckoutUtils.classes.disabled);
          const originalText = placeOrderBtn.getAttribute('data-original-text');
          if (originalText) {
            placeOrderBtn.textContent = originalText;
            placeOrderBtn.removeAttribute('data-original-text');
          }
        }

        // Remove loading state from order summary
        if (orderSummary) {
          orderSummary.classList.remove(...CheckoutUtils.classes.disabled);
        }

        // Remove loading state from shipping section
        if (shippingSection) {
          shippingSection.style.opacity = '';
          shippingSection.style.pointerEvents = '';
        }
      }
    },

    checkAndRefreshShippingOnLoad() {
      // Note: Automatic refresh on load disabled since we now use manual refresh
      // This was causing duplicate updates when shipping methods are selected
    },

    updateOrderSummaryFromTable(tableHtml, orderSummary) {
      // Legacy method - keeping for compatibility
      this.updateCustomOrderSummaryFromWooCommerceTable(tableHtml, orderSummary);
    },

    initializeShippingVisualState() {
      // Set initial visual state for any pre-selected shipping methods
      const shippingInputs = document.querySelectorAll(
        'input[name^="shipping_method"]'
      );
      shippingInputs.forEach((input) => {
        if (input.checked) {
          this.updateShippingVisualState(input);
        }
      });
    },

    updateShippingVisualState(changedInput) {
      // Get the package index for this input
      const packageIndex = changedInput.getAttribute("data-index") || "0";

      // Find all shipping method inputs for the same package
      const packageInputs = document.querySelectorAll(
        `input[name^="shipping_method"][data-index="${packageIndex}"]`
      );

      packageInputs.forEach((input) => {
        const label = input
          .closest(".shipping-method-option")
          ?.querySelector(".shipping-method-label");
        const radioButton = label?.querySelector(".radio-button");
        const radioInner = label?.querySelector(".radio-inner");

        if (label && radioButton && radioInner) {
          if (input === changedInput && input.checked) {
            // Selected state - only update radio button
            radioButton.classList.add("border-black");
            radioButton.classList.remove("border-gray-300");
            radioInner.classList.add("scale-100");
            radioInner.classList.remove("scale-0");
          } else {
            // Unselected state - only update radio button
            radioButton.classList.remove("border-black");
            radioButton.classList.add("border-gray-300");
            radioInner.classList.remove("scale-100");
            radioInner.classList.add("scale-0");
          }
        }
      });
    },

    async updateAppliedCoupons() {
      try {
        // Fetch fresh applied coupons data
        const response = await fetch(window.location.href, {
          method: "GET",
          credentials: "same-origin",
        });

        if (response.ok) {
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");

          // Find the applied coupons section in the fresh HTML
          const newAppliedCoupons = doc.querySelector(".applied-coupons");
          const currentAppliedCoupons =
            document.querySelector(".applied-coupons");

          if (newAppliedCoupons && currentAppliedCoupons) {
            // Replace the applied coupons section
            currentAppliedCoupons.innerHTML = newAppliedCoupons.innerHTML;
            currentAppliedCoupons.style.display = "";
          } else if (!newAppliedCoupons && currentAppliedCoupons) {
            // No coupons applied anymore, hide the section
            currentAppliedCoupons.style.display = "none";
          } else if (newAppliedCoupons && !currentAppliedCoupons) {
            // Need to add the applied coupons section
            const orderSummary = document.querySelector(".order-summary");
            const shippingSection = orderSummary?.querySelector(
              ".shipping-options, .coupon-section"
            );

            if (orderSummary && shippingSection) {
              // Clone the element to avoid moving it from the parsed document
              const clonedCoupons = newAppliedCoupons.cloneNode(true);
              shippingSection.insertAdjacentElement(
                "beforebegin",
                clonedCoupons
              );

              // Re-initialize Alpine.js for the new element
              if (window.Alpine) {
                Alpine.initTree(clonedCoupons);
              }
            }
          }

          // Re-initialize Alpine.js for updated elements
          if (window.Alpine && currentAppliedCoupons) {
            Alpine.initTree(currentAppliedCoupons);
          }
        }
      } catch (error) {
        // Silent fail - coupon display will still work on page refresh
      }
    },
  }));
});
