/**
 * WooCommerce Checkout Page Enhancement
 *
 * Provides real-time checkout updates, shipping calculations, payment method handling,
 * and coupon management using Alpine.js and WooCommerce Store API.
 *
 * @module checkout-page
 */

document.addEventListener("alpine:init", () => {
  // DOM Selectors
  const SELECTORS = {
    form: "form.checkout",
    placeOrderBtn: "#place_order",
    shippingMethods: ".shipping_method",
    paymentMethods: ".payment_method",
    couponField: "#coupon_code",
    notices: ".woocommerce-message, .woocommerce-info, .woocommerce-error",
    reviewOrder: ".woocommerce-checkout-review-order",
    orderSummary: ".order-summary",
    shippingSection: ".shipping-section",
    shipToDifferentCheckbox: "#ship-to-different-address-checkbox",
  };

  const CSS_CLASSES = {
    loading: ["opacity-75", "cursor-not-allowed"],
    disabled: ["opacity-50", "pointer-events-none"],
    borderBlack: "border-black",
    borderGray: "border-gray-300",
    scale100: "scale-100",
    scale0: "scale-0",
  };

  const DEBOUNCE_DELAYS = {
    standard: 1000,
    fast: 500,
    shippingMethod: 300,
    postcode: 1000,
    postcodeFastExit: 100,
    updateCooldown: 500,
    duplicateCheck: 1000,
  };

  const FIELD_NAMES = {
    billing: {
      country: "billing_country",
      state: "billing_state",
      city: "billing_city",
      postcode: "billing_postcode",
      address1: "billing_address_1",
      address2: "billing_address_2",
    },
    shipping: {
      country: "shipping_country",
      state: "shipping_state",
      city: "shipping_city",
      postcode: "shipping_postcode",
      address1: "shipping_address_1",
      address2: "shipping_address_2",
    },
  };

  const createSpinner = () => `
    <svg class="animate-spin h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  `;

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
      const shipCheckbox = document.querySelector(SELECTORS.shipToDifferentCheckbox);
      if (shipCheckbox) {
        this.shipToDifferentAddress = shipCheckbox.checked;
      }

      // Initialize selected payment method
      const selectedPayment = document.querySelector(`${SELECTORS.paymentMethods}:checked`);
      if (selectedPayment) {
        this.selectedPaymentMethod = selectedPayment.value;
        this.updatePaymentMethodVisuals(selectedPayment);
        this.togglePaymentBox(selectedPayment.value, true);
      }
    },

    setupEventListeners() {
      // Note: Let WooCommerce handle form submission natively for proper order processing
      // Custom AJAX submission was causing order processing errors

      // Prevent form submission if terms checkbox is not checked
      // Use capture phase to catch the event before WooCommerce handlers
      const checkoutForm = document.querySelector(SELECTORS.form);
      if (checkoutForm) {
        checkoutForm.addEventListener("submit", (e) => {
          if (!this.validateTermsAndConditions()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
          }
        }, true); // Use capture phase

        // Also handle place order button click
        const placeOrderBtn = document.querySelector(SELECTORS.placeOrderBtn);
        if (placeOrderBtn) {
          placeOrderBtn.addEventListener("click", (e) => {
            if (!this.validateTermsAndConditions()) {
              e.preventDefault();
              e.stopImmediatePropagation();
              return false;
            }
          }, true); // Use capture phase
        }
      }

      // Country/state changes for field updates
      document.addEventListener("change", (e) => {
        if (
          e.target.matches('select[name*="country"], select[name*="state"]')
        ) {
          this.updateCheckout();
        }
      });

      // Listen for country/state changes that might affect shipping
      document.addEventListener("change", (e) => {
        const billingSelector = `select[name="${FIELD_NAMES.billing.country}"], select[name="${FIELD_NAMES.billing.state}"]`;
        const shippingSelector = `select[name="${FIELD_NAMES.shipping.country}"], select[name="${FIELD_NAMES.shipping.state}"]`;

        // Billing country/state - only trigger if ship_to_different is unchecked
        if (e.target.matches(billingSelector) && !this.shipToDifferentAddress) {
          this.debouncedUpdateCheckout();
        }

        // Shipping country/state - only trigger if ship_to_different is checked
        if (e.target.matches(shippingSelector) && this.shipToDifferentAddress) {
          this.debouncedUpdateCheckout();
        }
      });
    },

    setupShippingHandlers() {
      // Handle shipping method changes
      document.addEventListener("change", (e) => {
        if (e.target.matches(SELECTORS.shippingMethods)) {
          this.updateShippingVisualState(e.target);
          this.handleShippingMethodChange(e.target);
        }
      });

      // Handle "ship to different address" checkbox changes
      document.addEventListener("change", (e) => {
        if (e.target.matches(SELECTORS.shipToDifferentCheckbox)) {
          this.shipToDifferentAddress = e.target.checked;
          setTimeout(() => this.updateCheckout(), DEBOUNCE_DELAYS.postcodeFastExit);
        }
      });

      // Set initial visual state for any pre-selected shipping methods
      this.initializeShippingVisualState();

      // Update shipping when address fields change
      document.addEventListener("blur", (e) => {
        const billingFields = `input[name="${FIELD_NAMES.billing.address1}"], input[name="${FIELD_NAMES.billing.address2}"], input[name="${FIELD_NAMES.billing.city}"], input[name="${FIELD_NAMES.billing.postcode}"], input[name="${FIELD_NAMES.billing.state}"]`;
        const shippingFields = `input[name="${FIELD_NAMES.shipping.address1}"], input[name="${FIELD_NAMES.shipping.address2}"], input[name="${FIELD_NAMES.shipping.city}"], input[name="${FIELD_NAMES.shipping.postcode}"], input[name="${FIELD_NAMES.shipping.state}"]`;

        // Billing address fields - only trigger if ship_to_different is unchecked
        if (e.target.matches(billingFields) && !this.shipToDifferentAddress) {
          this.debouncedUpdateCheckout();
        }

        // Shipping address fields - only trigger if ship_to_different is checked
        if (e.target.matches(shippingFields) && this.shipToDifferentAddress) {
          this.debouncedUpdateCheckout();
        }
      });

      // Postcode field handling with smart debouncing
      let postcodeInputTimer = null;
      const lastPostcodeValue = {};
      const postcodeSelector = `input[name="${FIELD_NAMES.billing.postcode}"], input[name="${FIELD_NAMES.shipping.postcode}"]`;

      document.addEventListener("input", (e) => {
        if (!e.target.matches(postcodeSelector)) return;

        const fieldName = e.target.name;
        const isBilling = fieldName === FIELD_NAMES.billing.postcode;

        // Only proceed if relevant to current shipping mode
        if ((isBilling && this.shipToDifferentAddress) || (!isBilling && !this.shipToDifferentAddress)) {
          return;
        }

        clearTimeout(postcodeInputTimer);
        lastPostcodeValue[fieldName] = e.target.value;

        postcodeInputTimer = setTimeout(() => {
          if (e.target.value === lastPostcodeValue[fieldName]) {
            this.updateCheckout();
          }
        }, DEBOUNCE_DELAYS.postcode);
      });

      // Trigger immediate update when user leaves the postcode field
      document.addEventListener("blur", (e) => {
        if (!e.target.matches(postcodeSelector)) return;

        const isBilling = e.target.name === FIELD_NAMES.billing.postcode;
        const shouldUpdate = (isBilling && !this.shipToDifferentAddress) || (!isBilling && this.shipToDifferentAddress);

        if (shouldUpdate) {
          clearTimeout(postcodeInputTimer);
          postcodeInputTimer = null;
          setTimeout(() => this.updateCheckout(), DEBOUNCE_DELAYS.postcodeFastExit);
        }
      }, true);

      // Trigger update on Enter key
      document.addEventListener("keydown", (e) => {
        if (!e.target.matches(postcodeSelector) || e.key !== 'Enter') return;

        const isBilling = e.target.name === FIELD_NAMES.billing.postcode;
        const shouldUpdate = (isBilling && !this.shipToDifferentAddress) || (!isBilling && this.shipToDifferentAddress);

        if (shouldUpdate) {
          e.preventDefault();
          clearTimeout(postcodeInputTimer);
          postcodeInputTimer = null;
          this.updateCheckout();
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
        if (!e.target.matches(SELECTORS.paymentMethods)) return;

        this.selectedPaymentMethod = e.target.value;
        this.updatePaymentMethodVisuals(e.target);
        this.togglePaymentBox(e.target.value, true);
      });

      // Handle clicks on labels for better UX
      document.addEventListener("click", (e) => {
        const label = e.target.closest(".payment-method-label");
        if (!label) return;

        const forAttr = label.getAttribute("for");
        if (!forAttr) return;

        const radioInput = document.querySelector(`#${forAttr}`);
        if (radioInput && !radioInput.checked) {
          radioInput.checked = true;
          radioInput.dispatchEvent(new Event("change", { bubbles: true }));
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


    async handleShippingMethodChange() {
      if (this.isUpdating) return;

      clearTimeout(this.shippingUpdateTimeout);

      this.shippingUpdateTimeout = setTimeout(async () => {
        const reviewOrder = document.querySelector(SELECTORS.reviewOrder);

        if (reviewOrder) {
          reviewOrder.style.opacity = "0.6";
          reviewOrder.style.pointerEvents = "none";
        }

        try {
          await this.updateCheckout();
        } catch (error) {
          console.error("Error updating shipping method:", error);
        } finally {
          if (reviewOrder) {
            reviewOrder.style.opacity = "";
            reviewOrder.style.pointerEvents = "";
          }
        }
      }, DEBOUNCE_DELAYS.shippingMethod);
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
          window.wc_coupon_params?.apply_coupon_nonce || ""
        );

        const ajaxUrl =
          window.wc_coupon_params?.wc_ajax_url?.replace(
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
            try {
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
            } catch (jsonError) {
              console.error("JSON parsing error:", jsonError);
              console.error("Response was supposed to be JSON but parsing failed");
              this.showError("Server returned invalid response. Please try again.");
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
          window.wc_coupon_params?.remove_coupon_nonce || ""
        );

        const ajaxUrl =
          window.wc_coupon_params?.wc_ajax_url?.replace(
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

    updatePaymentMethodVisuals(selectedInput) {
      document.querySelectorAll(SELECTORS.paymentMethods).forEach((input) => {
        const option = input.closest(".payment-method-option");
        const label = option?.querySelector(".payment-method-label");
        const radioButton = label?.querySelector(".radio-button");
        const radioInner = radioButton?.querySelector(".radio-inner");

        const isSelected = input === selectedInput;

        radioButton?.classList.toggle("border-gray-400", isSelected);
        radioInner?.classList.toggle(CSS_CLASSES.scale0, !isSelected);
        radioInner?.classList.toggle(CSS_CLASSES.scale100, isSelected);
      });
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
      if (this.isUpdating) return;

      this.isUpdating = true;

      try {
        this.showCheckoutLoadingState(true);
        await this.updateCustomerAddressInSession();
        await this.manualRefreshOrderSummary();

        setTimeout(() => {
          this.isUpdating = false;
        }, DEBOUNCE_DELAYS.updateCooldown);
      } catch (error) {
        console.error('updateCheckout error:', error);
        this.isUpdating = false;
      } finally {
        this.showCheckoutLoadingState(false);
      }
    },

    async updateCustomerAddressInSession() {
      const getFieldValue = (name) => {
        const field = document.querySelector(`[name="${name}"]`);
        return field?.value || '';
      };

      const useShippingAddress = this.shipToDifferentAddress;
      const addressType = useShippingAddress ? FIELD_NAMES.shipping : FIELD_NAMES.billing;

      const shippingAddressData = {
        country: getFieldValue(addressType.country),
        state: getFieldValue(addressType.state),
        city: getFieldValue(addressType.city),
        postcode: getFieldValue(addressType.postcode),
      };

      if (!shippingAddressData.country || !shippingAddressData.postcode) return;

      try {
        const requestBody = { shipping_address: shippingAddressData };

        if (!useShippingAddress) {
          requestBody.billing_address = {
            country: getFieldValue(FIELD_NAMES.billing.country),
            state: getFieldValue(FIELD_NAMES.billing.state),
            city: getFieldValue(FIELD_NAMES.billing.city),
            postcode: getFieldValue(FIELD_NAMES.billing.postcode),
          };
        }

        const response = await fetch('/wp-json/wc/store/v1/cart/update-customer', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Nonce': window.wpEndpoints?.storeApiNonce || '',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          console.warn('Failed to update customer address in session');
        }
      } catch (error) {
        console.warn('Error updating customer address:', error);
      }
    },

    async manualRefreshOrderSummary() {
      const updateId = Date.now() + Math.random();

      if (this.lastUpdateId && (updateId - this.lastUpdateId) < DEBOUNCE_DELAYS.duplicateCheck) {
        return;
      }

      this.lastUpdateId = updateId;

      const currentPaymentMethod = document.querySelector(`${SELECTORS.paymentMethods}:checked`);
      const savedPaymentMethodValue = currentPaymentMethod?.value || null;

      try {
        const response = await fetch(window.location.href, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (!response.ok) return;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const currentOrderSummary = document.querySelector(SELECTORS.orderSummary);
        const newOrderSummary = doc.querySelector(SELECTORS.orderSummary);

        if (!currentOrderSummary || !newOrderSummary) return;

        const wasUpdating = this.isUpdating;
        this.isUpdating = true;

        currentOrderSummary.innerHTML = newOrderSummary.innerHTML;

        if (window.Alpine) {
          Alpine.initTree(currentOrderSummary);
        }

        this.initializeShippingVisualState();

        if (savedPaymentMethodValue) {
          const paymentMethodToRestore = document.querySelector(`input[name="payment_method"][value="${savedPaymentMethodValue}"]`);
          if (paymentMethodToRestore) {
            paymentMethodToRestore.checked = true;
            this.selectedPaymentMethod = savedPaymentMethodValue;
            this.updatePaymentMethodVisuals(paymentMethodToRestore);
            this.togglePaymentBox(savedPaymentMethodValue, true);
          }
        }

        this.isUpdating = wasUpdating;
      } catch (error) {
        console.error('Manual refresh failed:', error);
      }
    },

    debouncedUpdateCheckout: (() => {
      let timeout;
      return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.updateCheckout(), DEBOUNCE_DELAYS.standard);
      };
    })(),

    debouncedUpdateCheckoutFast: (() => {
      let timeout;
      return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.updateCheckout(), DEBOUNCE_DELAYS.fast);
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

      const notices = doc.querySelectorAll(SELECTORS.notices);
      if (notices.length) {
        this.displayNotices(notices);
      }

      const newReviewOrder = doc.querySelector(SELECTORS.reviewOrder);
      const currentReviewOrder = document.querySelector(SELECTORS.reviewOrder);

      if (newReviewOrder && currentReviewOrder) {
        currentReviewOrder.innerHTML = newReviewOrder.innerHTML;
        window.Alpine?.initTree(currentReviewOrder);
      } else {
        const newOrderSummary = doc.querySelector(SELECTORS.orderSummary);
        const currentOrderSummary = document.querySelector(SELECTORS.orderSummary);

        if (newOrderSummary && currentOrderSummary) {
          currentOrderSummary.innerHTML = newOrderSummary.innerHTML;
          window.Alpine?.initTree(currentOrderSummary);
        }
      }

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
      const shippingCountry = document.querySelector(`select[name="${FIELD_NAMES.shipping.country}"]`);
      const shippingState = document.querySelector(`select[name="${FIELD_NAMES.shipping.state}"], input[name="${FIELD_NAMES.shipping.state}"]`);
      const shippingCity = document.querySelector(`input[name="${FIELD_NAMES.shipping.city}"]`);
      const shippingPostcode = document.querySelector(`input[name="${FIELD_NAMES.shipping.postcode}"]`);

      if (shippingCountry && country) shippingCountry.value = country;
      if (shippingState && state) shippingState.value = state;
      if (shippingCity && city) shippingCity.value = city;
      if (shippingPostcode && postcode) shippingPostcode.value = postcode;

      const shipToDifferent = document.querySelector(SELECTORS.shipToDifferentCheckbox);
      if (shipToDifferent && !shipToDifferent.checked) {
        shipToDifferent.checked = true;
        this.shipToDifferentAddress = true;

        const formData = new FormData();
        formData.append('action', 'store_ship_to_different');
        formData.append('value', '1');

        fetch(`${window.location.origin}/wp-admin/admin-ajax.php`, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        });
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
      document.querySelectorAll(SELECTORS.notices).forEach((notice) => notice.remove());

      const form = document.querySelector(SELECTORS.form);
      if (!form || !notices.length) return;

      notices.forEach((notice) => {
        form.insertBefore(notice.cloneNode(true), form.firstChild);
      });
    },

    showError(message) {
      document.querySelectorAll(".coupon-error-message").forEach((error) => error.remove());

      const errorDiv = document.createElement("div");
      errorDiv.className = "coupon-error-message woocommerce-error bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4 relative";
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

      const form = document.querySelector(SELECTORS.form);
      if (!form) return;

      form.insertBefore(errorDiv, form.firstChild);
      errorDiv.scrollIntoView({ behavior: "smooth" });

      setTimeout(() => {
        if (!errorDiv.parentNode) return;
        errorDiv.style.transition = "opacity 0.5s ease-out";
        errorDiv.style.opacity = "0";
        setTimeout(() => errorDiv.remove(), 500);
      }, 5000);
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
        const response = await fetch(window.location.href, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (!response.ok) return;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const shippingSelector = `${SELECTORS.orderSummary} ${SELECTORS.shippingSection}`;
        const currentShippingSection = document.querySelector(shippingSelector);
        const newShippingSection = doc.querySelector(shippingSelector);

        if (!currentShippingSection || !newShippingSection) return;

        currentShippingSection.innerHTML = newShippingSection.innerHTML;
        window.Alpine?.initTree(currentShippingSection);
        this.initializeShippingVisualState();
      } catch (error) {
        // Silent fail
      }
    },

    showCheckoutLoadingState(show) {
      const orderSummary = document.querySelector(SELECTORS.orderSummary);
      const placeOrderBtn = document.querySelector(SELECTORS.placeOrderBtn);
      const shippingSection = document.querySelector(`${SELECTORS.orderSummary} ${SELECTORS.shippingSection}`);

      if (show) {
        if (placeOrderBtn) {
          placeOrderBtn.disabled = true;
          placeOrderBtn.classList.add(...CSS_CLASSES.disabled);
          placeOrderBtn.setAttribute('data-original-text', placeOrderBtn.textContent);
          placeOrderBtn.textContent = 'Updating...';
        }

        orderSummary?.classList.add(...CSS_CLASSES.disabled);

        if (shippingSection) {
          shippingSection.style.opacity = '0.6';
          shippingSection.style.pointerEvents = 'none';
        }
      } else {
        if (placeOrderBtn) {
          placeOrderBtn.disabled = false;
          placeOrderBtn.classList.remove(...CSS_CLASSES.disabled);
          const originalText = placeOrderBtn.getAttribute('data-original-text');
          if (originalText) {
            placeOrderBtn.textContent = originalText;
            placeOrderBtn.removeAttribute('data-original-text');
          }
        }

        orderSummary?.classList.remove(...CSS_CLASSES.disabled);

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
      const packageIndex = changedInput.getAttribute("data-index") || "0";
      const packageInputs = document.querySelectorAll(`input[name^="shipping_method"][data-index="${packageIndex}"]`);

      packageInputs.forEach((input) => {
        const label = input.closest(".shipping-method-option")?.querySelector(".shipping-method-label");
        const radioButton = label?.querySelector(".radio-button");
        const radioInner = label?.querySelector(".radio-inner");

        if (!label || !radioButton || !radioInner) return;

        const isSelected = input === changedInput && input.checked;

        radioButton.classList.toggle(CSS_CLASSES.borderBlack, isSelected);
        radioButton.classList.toggle(CSS_CLASSES.borderGray, !isSelected);
        radioInner.classList.toggle(CSS_CLASSES.scale100, isSelected);
        radioInner.classList.toggle(CSS_CLASSES.scale0, !isSelected);
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

    validateTermsAndConditions() {
      const termsCheckbox = document.querySelector('input[name="terms"]');

      // If no terms checkbox exists, validation passes
      if (!termsCheckbox) {
        return true;
      }

      // Check if terms checkbox is checked
      if (!termsCheckbox.checked) {
        // Prevent processing
        this.processing = false;

        // Disable and reset the place order button
        const placeOrderBtn = document.querySelector(SELECTORS.placeOrderBtn);
        if (placeOrderBtn) {
          placeOrderBtn.disabled = false;
          placeOrderBtn.classList.remove(...CSS_CLASSES.loading);
        }

        // Scroll to the terms checkbox
        termsCheckbox.scrollIntoView({ behavior: "smooth", block: "center" });

        // Show error message
        this.showError("You must agree to the terms and conditions before placing your order.");

        // Add visual feedback to the checkbox area
        const termsSection = termsCheckbox.closest(".terms-section");
        if (termsSection) {
          termsSection.classList.add("border", "border-red-500", "p-3", "rounded");

          // Remove the highlight after 3 seconds
          setTimeout(() => {
            termsSection.classList.remove("border", "border-red-500", "p-3", "rounded");
          }, 3000);
        }

        // Also focus the checkbox for accessibility
        termsCheckbox.focus();

        return false;
      }

      return true;
    },
  }));
});
