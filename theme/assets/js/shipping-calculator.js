// Initialize shipping calculator functionality
const initShippingCalculator = () => {
  // Prevent multiple initializations more aggressively
  if (window.ShippingCalculatorInitialized) {
    return;
  }

  window.ShippingCalculatorInitialized = true;

  const ShippingCalculator = {
    setupCustomShippingForm() {
      // Always try to set up, as DOM might have been refreshed
      const toggleButton = document.querySelector(".shipping-address-toggle");
      if (toggleButton) {
        // Check if we already have our event listener
        if (!toggleButton.hasAttribute('data-shipping-calculator-attached')) {
          // Add our event listener directly to the button
          toggleButton.addEventListener("click", this.handleToggleClick.bind(this));
          toggleButton.setAttribute('data-shipping-calculator-attached', 'true');
        }
      }
    },

    // Method to re-initialize after DOM updates
    reinitialize() {
      this.setupCustomShippingForm();
      this.setupFormSubmission();
    },

    handleToggleClick(e) {
      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling

      const form = document.querySelector("#custom-shipping-form");
      const button = e.target;

      if (form) {
        const isHidden = form.classList.contains("hidden");

        if (isHidden) {
          form.classList.remove("hidden");
          button.setAttribute("aria-expanded", "true");
        } else {
          form.classList.add("hidden");
          button.setAttribute("aria-expanded", "false");
        }
      }
    },

    setupFormSubmission() {
      // Handle form submission
      document.addEventListener("submit", (e) => {
        if (e.target.matches(".custom-shipping-calculator")) {
          e.preventDefault();
          this.updateShippingAddress(e.target);
        }
      });
    },

    async updateShippingAddress(form) {
      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;

      // Show loading state
      submitButton.disabled = true;
      submitButton.textContent = "Updating...";

      // Get form data
      const formData = new FormData(form);
      const country = formData.get("shipping_country");
      const state = formData.get("shipping_state");
      const city = formData.get("shipping_city");
      const postcode = formData.get("shipping_postcode");

      try {
        // Use WooCommerce Store API to update customer address
        const response = await fetch(
          "/wp-json/wc/store/v1/cart/update-customer",
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              Nonce: window.wpEndpoints?.storeApiNonce || "",
            },
            body: JSON.stringify({
              billing_address: {
                country: country,
                state: state,
                city: city,
                postcode: postcode,
              },
            }),
          }
        );

        if (response.ok) {
          // Try to refresh cart fragments via cart page component
          const cartPageElement = document.querySelector(
            '[x-data*="cartPage"]'
          );
          if (cartPageElement && window.Alpine) {
            const cartPageData = Alpine.$data(cartPageElement);
            if (cartPageData && cartPageData.refreshCartFragments) {
              await cartPageData.refreshCartFragments();
              cartPageData.dispatchCartUpdateEvent();
            }
          } else {
            // Fallback: reload the page if Alpine.js cart component is not available
            window.location.reload();
          }

          // Hide the form
          const formContainer = document.querySelector("#custom-shipping-form");
          const toggleButton = document.querySelector(
            ".shipping-address-toggle"
          );

          if (formContainer) {
            formContainer.classList.add("hidden");
          }
          if (toggleButton) {
            toggleButton.setAttribute("aria-expanded", "false");
          }
        } else {
          throw new Error("Failed to update shipping address");
        }
      } catch (error) {
        this.showShippingError(
          "Failed to update shipping address. Please try again."
        );
      } finally {
        // Reset button
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    },

    showShippingError(message) {
      // Remove any existing shipping error messages first
      const existingErrors = document.querySelectorAll(
        ".shipping-error-message"
      );
      existingErrors.forEach((error) => error.remove());

      const errorDiv = document.createElement("div");
      errorDiv.className =
        "shipping-error-message woocommerce-error bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4 relative";

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

      const shippingSection = document.querySelector(
        ".shipping-section, .shipping-methods-container"
      );
      if (shippingSection) {
        shippingSection.insertBefore(errorDiv, shippingSection.firstChild);
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

    init() {
      this.setupCustomShippingForm();
      this.setupFormSubmission();
    },
  };

  // Initialize shipping calculator
  ShippingCalculator.init();

  // Make available globally for other scripts
  window.ShippingCalculator = ShippingCalculator;
};

// Initialize only once when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShippingCalculator);
} else {
  initShippingCalculator();
}
