document.addEventListener("alpine:init", () => {
  const CartUtils = {
    selectors: {
      updateBtn: ".update-cart-btn",
      quantityInputs: ".cart-qty-input",
      notices: ".woocommerce-message, .woocommerce-info, .woocommerce-error",
    },

    classes: {
      disabled: ["opacity-50", "cursor-not-allowed"],
      loading: ["opacity-75", "cursor-not-allowed"],
      hover: ["hover:bg-[#FFF200]", "hover:text-black"],
    },

    createSpinner() {
      return (
        '<svg class="animate-spin h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24">' +
        '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
        "</svg>"
      );
    },

    fadeOutElement(element, delay = 4000) {
      setTimeout(() => {
        element.style.transition = "opacity 0.5s ease-out";
        element.style.opacity = "0";
        setTimeout(() => element.remove(), 500);
      }, delay);
    },

    resetNoticeStyles(notice) {
      notice.removeAttribute("tabindex");
      notice.blur();
      Object.assign(notice.style, {
        outline: "none",
        border: "none",
        boxShadow: "none",
      });
    },
  };

  Alpine.data("cartPage", () => ({
    updating: false,
    couponCode: "",
    init() {
      this.autoHideNotices();
      this.setupUpdateButton();
      this.setupQuantityTracking();
      this.setupShippingHandlers();
      this.setupCouponHandlers();
    },

    autoHideNotices() {
      const notices = document.querySelectorAll(CartUtils.selectors.notices);

      notices.forEach((notice) => {
        CartUtils.resetNoticeStyles(notice);
        CartUtils.fadeOutElement(notice);
      });
    },

    setupUpdateButton() {
      const updateBtn = document.querySelector(CartUtils.selectors.updateBtn);
      if (!updateBtn) return;

      updateBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.updateCartAjax();
      });
    },

    setupQuantityTracking() {
      const quantityInputs = document.querySelectorAll(
        CartUtils.selectors.quantityInputs
      );
      const updateBtn = document.querySelector(CartUtils.selectors.updateBtn);

      if (!updateBtn) return;

      // Initially disable the button
      updateBtn.disabled = true;
      updateBtn.classList.add(...CartUtils.classes.disabled);

      quantityInputs.forEach((input) => {
        const originalValue = input.value;

        input.addEventListener("input", () => {
          const hasChanges = Array.from(quantityInputs).some(
            (inp) => inp.value !== inp.defaultValue
          );
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
        const quantityInputs = document.querySelectorAll(
          CartUtils.selectors.quantityInputs
        );
        const updates = [];

        quantityInputs.forEach((input) => {
          const itemKey = input.name.match(/cart\[(.*?)\]/)?.[1];
          if (itemKey && input.value !== input.defaultValue) {
            updates.push({
              key: itemKey,
              quantity: parseInt(input.value) || 0,
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
          updateBtn.innerHTML = "Update Cart";
        }
      } catch (error) {
        console.error("Error updating cart:", error);
        alert("Failed to update cart. Please try again.");
      } finally {
        this.updating = false;
      }
    },

    async makeStoreApiRequest(url, options = {}) {
      const defaultOptions = {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Nonce: window.wpEndpoints?.storeApiNonce || "",
        },
      };

      return fetch(url, { ...defaultOptions, ...options });
    },

    async updateQuantityByKey(itemKey, newQuantity) {
      const response = await this.makeStoreApiRequest(
        "/wp-json/wc/store/v1/cart/update-item",
        {
          method: "POST",
          body: JSON.stringify({
            key: itemKey,
            quantity: parseInt(newQuantity),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update item quantity");
      }

      return response;
    },

    async removeItemByKey(itemKey) {
      const response = await this.makeStoreApiRequest(
        `/wp-json/wc/store/v1/cart/items/${itemKey}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove item");
      }

      // Remove the item element from DOM
      const itemElement = document
        .querySelector(`input[name*="${itemKey}"]`)
        ?.closest(".cart-item");
      if (itemElement) {
        itemElement.style.transition = "opacity 0.3s ease-out";
        itemElement.style.opacity = "0";
        setTimeout(() => itemElement.remove(), 300);
      }

      return response;
    },

    async refreshCartFragments() {
      const cartItemsSection = document.querySelector(".cart-items-section");
      const cartTotals = document.querySelector(".lg\\:col-span-5");

      // Disable cart areas during refresh
      this.disableCartAreas(cartItemsSection, cartTotals);

      try {
        // Fetch updated cart page content
        const response = await fetch(window.location.href, {
          method: "GET",
          credentials: "same-origin",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch updated cart content");
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Update only the cart items section (not the related products)
        const currentCartItemsSection = document.querySelector(
          ".cart-items-section"
        );
        const newCartItemsSection = doc.querySelector(".cart-items-section");

        if (currentCartItemsSection && newCartItemsSection) {
          // Preserve Alpine.js data by updating innerHTML instead of replacing element
          currentCartItemsSection.innerHTML = newCartItemsSection.innerHTML;

          // Reinitialize Alpine.js components for the updated content
          if (window.Alpine) {
            Alpine.initTree(currentCartItemsSection);
          }
        }

        // Update cart totals area
        const currentCartTotals = document.querySelector(".lg\\:col-span-5");
        const newCartTotals = doc.querySelector(".lg\\:col-span-5");

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

        // Re-initialize shipping visual state after fragment refresh
        this.initializeShippingVisualState();
      } catch (error) {
        console.error("Error refreshing cart fragments:", error);
        // Fallback to page reload if fragment update fails
        window.location.reload();
      } finally {
        // Re-enable cart areas after refresh
        this.enableCartAreas(cartItemsSection, cartTotals);
      }
    },

    disableCartAreas(cartContent, cartTotals) {
      [cartContent, cartTotals].forEach((area) => {
        if (area) {
          // Add simple disabled styling
          area.classList.add("opacity-50", "pointer-events-none");

          // Disable all interactive elements including checkout buttons
          const interactiveElements = area.querySelectorAll(
            'button, input, a, select, .checkout-button, [href*="checkout"]'
          );
          interactiveElements.forEach((el) => {
            const wasDisabled =
              el.disabled || el.classList.contains("disabled");
            el.disabled = true;
            el.classList.add("disabled");
            el.setAttribute(
              "data-was-disabled",
              wasDisabled ? "true" : "false"
            );
          });
        }
      });
    },

    enableCartAreas(cartContent, cartTotals) {
      [cartContent, cartTotals].forEach((area) => {
        if (area) {
          // Remove disabled styling
          area.classList.remove("opacity-50", "pointer-events-none");

          // Re-enable interactive elements
          const interactiveElements = area.querySelectorAll(
            "[data-was-disabled]"
          );
          interactiveElements.forEach((el) => {
            const wasDisabled = el.getAttribute("data-was-disabled") === "true";
            el.disabled = wasDisabled;
            if (!wasDisabled) {
              el.classList.remove("disabled");
            }
            el.removeAttribute("data-was-disabled");
          });
        }
      });
    },

    setupShippingHandlers() {
      // Prevent default WooCommerce shipping calculator behavior
      this.disableDefaultShippingCalculator();

      // Handle shipping method changes
      document.addEventListener("change", (e) => {
        if (
          e.target.matches(
            'select.shipping_method, input[name^="shipping_method"]'
          )
        ) {
          this.updateShippingVisualState(e.target);
          this.handleShippingMethodChange(e.target);
        }
      });

      // Set initial visual state for any pre-selected shipping methods
      this.initializeShippingVisualState();

      // Handle shipping calculator
      document.addEventListener("click", (e) => {
        // Handle shipping calculator button - look for multiple possible selectors
        if (
          e.target.matches(
            '.shipping-calculator-button'
          ) ||
          (e.target.matches('a[href="#"]') && e.target.textContent.toLowerCase().includes('shipping'))
        ) {
          e.preventDefault();
          e.stopPropagation();

          // Find the calculator form - it could be a sibling or in a parent container
          let form = e.target.nextElementSibling;
          if (!form || (!form.classList.contains("shipping-calculator-form") && !form.classList.contains("woocommerce-shipping-calculator") && form.id !== "shipping-calculator-form")) {
            // Try to find it as a sibling of the parent
            const parent = e.target.parentElement;
            form = parent.querySelector(".shipping-calculator-form, .woocommerce-shipping-calculator, #shipping-calculator-form");
          }
          if (!form) {
            // Try to find it anywhere in the shipping section
            const shippingSection = e.target.closest(
              ".shipping, .woocommerce-shipping-totals, .shipping-section"
            );
            if (shippingSection) {
              form = shippingSection.querySelector(".shipping-calculator-form, .woocommerce-shipping-calculator, #shipping-calculator-form");
            }
          }
          if (!form) {
            // Final fallback - look for it anywhere in the document
            form = document.querySelector("#shipping-calculator-form");
          }

          if (form) {
            // Toggle the form visibility using classes instead of inline styles
            if (form.classList.contains("open")) {
              form.classList.remove("open");
            } else {
              form.classList.add("open");
            }
          }

          return false;
        }

        // Handle shipping calculator form submission
        if (e.target.matches('input[name="calc_shipping"]')) {
          e.preventDefault();
          this.handleShippingCalculation(e.target);
        }
      });
    },

    async handleShippingMethodChange(target) {
      const cartTotals = document.querySelector(".cart-totals");

      // Show loading state
      if (cartTotals) {
        cartTotals.style.opacity = "0.6";
        cartTotals.style.pointerEvents = "none";
      }

      try {
        // Collect all selected shipping methods
        const shippingMethods = {};
        document
          .querySelectorAll(
            'select.shipping_method, input[name^="shipping_method"]:checked, input[name^="shipping_method"][type="hidden"]'
          )
          .forEach((input) => {
            const index = input.getAttribute("data-index") || "0";
            shippingMethods[index] = input.value;
          });

        // Update shipping method via AJAX
        const response = await fetch(
          window.wc_cart_params?.wc_ajax_url?.replace(
            "%%endpoint%%",
            "update_shipping_method"
          ) ||
            "/wp-admin/admin-ajax.php?action=woocommerce_update_shipping_method",
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              shipping_method: JSON.stringify(shippingMethods),
              security:
                window.wc_cart_params?.update_shipping_method_nonce || "",
            }),
          }
        );

        if (response.ok) {
          // Refresh cart fragments to show updated totals
          await this.refreshCartFragments();
          this.dispatchCartUpdateEvent();
        }
      } catch (error) {
        console.error("Error updating shipping method:", error);
      } finally {
        // Remove loading state
        if (cartTotals) {
          cartTotals.style.opacity = "";
          cartTotals.style.pointerEvents = "";
        }
      }
    },

    async handleShippingCalculation(submitButton) {
      const form = submitButton.closest("form");
      const cartTotals = document.querySelector(".cart-totals");

      if (!form) return;

      // Show loading state
      if (cartTotals) {
        cartTotals.style.opacity = "0.6";
        cartTotals.style.pointerEvents = "none";
      }

      try {
        const formData = new FormData(form);

        const response = await fetch(form.action || window.location.href, {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        });

        if (response.ok) {
          // Refresh the entire cart to show calculated shipping
          await this.refreshCartFragments();
          this.dispatchCartUpdateEvent();
        }
      } catch (error) {
        console.error("Error calculating shipping:", error);
        // Fallback to page reload
        window.location.reload();
      } finally {
        // Remove loading state
        if (cartTotals) {
          cartTotals.style.opacity = "";
          cartTotals.style.pointerEvents = "";
        }
      }
    },

    disableDefaultShippingCalculator() {
      // Remove any existing WooCommerce shipping calculator event listeners
      const existingButtons = document.querySelectorAll(
        ".woocommerce-shipping-destination a, .shipping-calculator-button"
      );
      existingButtons.forEach((button) => {
        // Clone the button to remove all event listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        // Ensure the href doesn't cause page navigation
        if (newButton.tagName === "A") {
          newButton.href = "#";
          newButton.removeAttribute("onclick");
        }
      });

      // Prevent jQuery/WooCommerce from handling calculator toggles
      if (window.jQuery) {
        window
          .jQuery(document)
          .off("click.woocommerce", ".shipping-calculator-button");
        window
          .jQuery(document)
          .off("click", ".woocommerce-shipping-destination a");
      }
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

    setupCouponHandlers() {
      // Handle coupon removal clicks
      document.addEventListener("click", (e) => {
        if (e.target.matches('a[data-coupon], .remove-coupon')) {
          e.preventDefault();
          const couponCode = e.target.getAttribute('data-coupon') || 
                           e.target.closest('[data-coupon]')?.getAttribute('data-coupon') ||
                           e.target.getAttribute('href')?.match(/remove_coupon=([^&]+)/)?.[1];
          if (couponCode) {
            this.removeCoupon(couponCode);
          }
        }
      });
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

        const ajaxUrl = window.wc_checkout_params?.wc_ajax_url?.replace('%%endpoint%%', 'apply_coupon') || 
                        '/wp-admin/admin-ajax.php?action=woocommerce_apply_coupon';

        const response = await fetch(ajaxUrl, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            
            if (result.success) {
              this.couponCode = '';
              await this.refreshCartFragments();
              this.dispatchCartUpdateEvent();
            } else {
              this.showError(result.data || 'Failed to apply coupon.');
            }
          } else {
            // Handle HTML response
            this.couponCode = '';
            await this.refreshCartFragments();
            this.dispatchCartUpdateEvent();
          }
        } else {
          this.showError('Failed to apply coupon. Please try again.');
        }
      } catch (error) {
        this.showError('Failed to apply coupon. Please try again.');
      }
    },

    async removeCoupon(couponCode) {
      if (!couponCode) {
        return;
      }

      try {
        const formData = new FormData();
        formData.append('coupon_code', couponCode);
        formData.append('security', window.wc_checkout_params?.remove_coupon_nonce || '');

        const ajaxUrl = window.wc_checkout_params?.wc_ajax_url?.replace('%%endpoint%%', 'remove_coupon') || 
                        '/wp-admin/admin-ajax.php?action=woocommerce_remove_coupon';

        const response = await fetch(ajaxUrl, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          await this.refreshCartFragments();
          this.dispatchCartUpdateEvent();
        } else {
          this.showError('Failed to remove coupon. Please try again.');
        }
      } catch (error) {
        this.showError('Failed to remove coupon. Please try again.');
      }
    },

    showError(message) {
      // Remove any existing error messages first
      const existingErrors = document.querySelectorAll('.coupon-error-message');
      existingErrors.forEach(error => error.remove());

      const errorDiv = document.createElement('div');
      errorDiv.className = 'coupon-error-message woocommerce-error bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4 relative';
      
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

      const cartContent = document.querySelector('.cart-content, .woocommerce-cart-form, main');
      if (cartContent) {
        cartContent.insertBefore(errorDiv, cartContent.firstChild);
        errorDiv.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.style.transition = 'opacity 0.5s ease-out';
            errorDiv.style.opacity = '0';
            setTimeout(() => {
              if (errorDiv.parentNode) {
                errorDiv.remove();
              }
            }, 500);
          }
        }, 5000);
      }
    },

    dispatchCartUpdateEvent() {
      document.dispatchEvent(
        new CustomEvent("cart-updated", {
          detail: {
            source: "cart-page",
          },
        })
      );
    },

    updateCart() {
      // Fallback for any remaining form submissions
      this.updateCartAjax();
    },
  }));

  Alpine.data("cartItem", () => ({
    removing: false,

    async removeItem(itemKey) {
      if (
        !confirm("Are you sure you want to remove this item from your cart?")
      ) {
        return;
      }

      this.removing = true;

      // Get reference to cart page component for fragment refresh
      const cartPageElement = document.querySelector('[x-data*="cartPage"]');
      const cartPageData = cartPageElement
        ? Alpine.$data(cartPageElement)
        : null;

      try {
        const response = await this.makeStoreApiRequest(
          `/wp-json/wc/store/v1/cart/items/${itemKey}`,
          {
            method: "DELETE",
          }
        );

        if (response.ok) {
          // Remove the item from DOM immediately for instant feedback
          this.$el.style.transition = "opacity 0.3s ease-out";
          this.$el.style.opacity = "0";

          setTimeout(async () => {
            this.$el.remove();

            // Refresh cart fragments like the update cart button does
            if (cartPageData && cartPageData.refreshCartFragments) {
              await cartPageData.refreshCartFragments();
            }
          }, 300);

          this.dispatchCartUpdateEvent();
        } else {
          console.error("Failed to remove cart item");
          alert("Failed to remove item. Please try again.");
        }
      } catch (error) {
        console.error("Error removing cart item:", error);
        alert("Failed to remove item. Please try again.");
      } finally {
        this.removing = false;
      }
    },

    async makeStoreApiRequest(url, options = {}) {
      const defaultOptions = {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Nonce: window.wpEndpoints?.storeApiNonce || "",
        },
      };

      return fetch(url, { ...defaultOptions, ...options });
    },

    dispatchCartUpdateEvent() {
      document.dispatchEvent(
        new CustomEvent("cart-updated", {
          detail: {
            source: "cart-page",
          },
        })
      );
    },

    get removeButtonClasses() {
      return {
        "opacity-50 cursor-not-allowed": this.removing,
        "hover:text-red-500": !this.removing,
      };
    },
  }));
});
