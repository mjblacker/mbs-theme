// Alpine.js Single Product Components

document.addEventListener("alpine:init", () => {
  // Initialize cart count store
  Alpine.store("initialCartCount", 0);

  // Single Product Main Component
  Alpine.data("singleProduct", () => ({
    hasVariations: false,
    currentVariation: null,
    selectedAttributes: {},
    currentPrice: null,
    originalPrice: null,
    isOnSale: false,

    init() {
      this.detectVariations();
      this.initializeWooCommerceIntegration();
      this.setupPriceElements();
      this.listenForVariationChanges();
    },

    detectVariations() {
      // Check if product has variations or custom variation attributes
      const variationForm = document.querySelector(".variations_form");
      const hasCustomVariations = document.querySelector(
        '[name="attribute_size"], [name="attribute_color"]'
      );
      this.hasVariations = !!(variationForm || hasCustomVariations);

      if (this.hasVariations) {
        this.initializeVariationHandling();
      }
    },

    setupPriceElements() {
      // Store original price for fallback
      const priceElement = document.querySelector(".product-price");
      if (priceElement) {
        this.originalPrice = priceElement.innerHTML;
        this.currentPrice = this.originalPrice;
      }
    },

    listenForVariationChanges() {
      // Listen for custom variation changes from size/color components
      document.addEventListener("variation-changed", (event) => {
        this.selectedAttributes[event.detail.attribute] = event.detail.value;
        this.findMatchingVariation();
      });
    },

    initializeVariationHandling() {
      // Listen for WooCommerce variation changes
      document.addEventListener("found_variation", (event) => {
        this.currentVariation = event.detail.variation;
        this.updatePrice(event.detail.variation);
        this.updateCustomFields();
      });

      document.addEventListener("reset_data", () => {
        this.currentVariation = null;
        this.resetPrice();
        this.updateCustomFields();
      });
    },

    findMatchingVariation() {
      // For WooCommerce products, try to find matching variation
      const variationData = this.getVariationData();

      if (!variationData || !variationData.length) return;

      const matchingVariation = variationData.find((variation) => {
        if (!variation.attributes) return false;

        // Check if all selected attributes match
        return Object.entries(this.selectedAttributes).every(
          ([attr, value]) => {
            if (!value) return true; // Skip unselected attributes

            const attrKey = `attribute_${attr}`;
            const variationValue = variation.attributes[attrKey];

            // Handle empty variation attributes (means any value)
            if (variationValue === "" || variationValue === null) return true;

            return variationValue.toLowerCase() === value.toLowerCase();
          }
        );
      });

      if (matchingVariation) {
        this.currentVariation = matchingVariation;
        this.updatePrice(matchingVariation);
        this.updateCustomFields();

        // Trigger WooCommerce found_variation event
        document.dispatchEvent(
          new CustomEvent("found_variation", {
            detail: { variation: matchingVariation },
          })
        );
      } else {
        this.resetPrice();
        this.currentVariation = null;
      }
    },

    getVariationData() {
      // Try to get variation data from various sources
      const variationForm = document.querySelector(".variations_form");
      if (variationForm && variationForm.dataset.product_variations) {
        try {
          return JSON.parse(variationForm.dataset.product_variations);
        } catch (e) {
          // Silently handle parsing errors
        }
      }

      // Check for inline variation data
      const variationScript = document.querySelector("script[data-variations]");
      if (variationScript) {
        try {
          return JSON.parse(variationScript.dataset.variations);
        } catch (e) {
          // Silently handle parsing errors
        }
      }

      return null;
    },

    updatePrice(variation) {
      const priceElement = document.querySelector(".product-price");
      if (!priceElement || !variation) return;

      let priceHtml = "";
      const salePrice = parseFloat(variation.display_price);
      const regularPrice = parseFloat(variation.display_regular_price);

      if (variation.price_html && !regularPrice) {
        // Use WooCommerce formatted price if available and no sale
        priceHtml = variation.price_html;
        priceHtml +=
          '<span class="text-sm text-gray-500 font-normal ml-2">INC GST</span>';
      } else if (salePrice) {
        // Format price manually with custom layout
        const formattedSale = this.formatPrice(salePrice);

        if (regularPrice && regularPrice > salePrice) {
          // On sale - show sale price, regular price, INC GST, and savings percentage
          const formattedRegular = this.formatPrice(regularPrice);
          const savingsPercent = Math.round(
            ((regularPrice - salePrice) / regularPrice) * 100
          );

          priceHtml = `
            <div class="flex items-center gap-3 flex-wrap">
              <div class="text-2xl font-bold text-gray-900">${formattedSale}</div>
              <div class="text-lg text-gray-500 line-through">${formattedRegular}</div>
              <span class="text-sm text-gray-500 font-normal">INC GST</span>
              <div class="bg-green-600 text-white px-2 py-1 rounded text-sm font-medium">-${savingsPercent}%</div>
            </div>
          `;
          this.isOnSale = true;
        } else {
          // Regular price - no sale
          priceHtml = `
            <div class="flex items-center gap-3">
              <div class="text-2xl font-bold text-gray-900">${formattedSale}</div>
              <span class="text-sm text-gray-500 font-normal">INC GST</span>
            </div>
          `;
          this.isOnSale = false;
        }
      }

      if (priceHtml) {
        priceElement.innerHTML = priceHtml;
        this.currentPrice = priceHtml;
      }
    },

    resetPrice() {
      const priceElement = document.querySelector(".product-price");
      if (priceElement && this.originalPrice) {
        priceElement.innerHTML = this.originalPrice;
        this.currentPrice = this.originalPrice;
        this.isOnSale = false;
      }
    },

    formatPrice(price) {
      // Basic price formatting - you might want to use WooCommerce's formatting
      const currency = window.woocommerce_currency || "$";
      const formattedPrice = parseFloat(price).toFixed(2);
      return `<span class="woocommerce-Price-amount amount">${currency}${formattedPrice}</span>`;
    },

    updateCustomFields() {
      // Update custom fields based on variation selection
      if (this.currentVariation) {
        this.updateCoverageField();
        this.updatePanelWeightField();
        this.updateDownloadLinks();
      }
    },

    updateCoverageField() {
      const coverageElement = document.querySelector("[data-coverage-field]");
      if (coverageElement && this.currentVariation.coverage_m2) {
        coverageElement.textContent = this.currentVariation.coverage_m2 + " M²";
      }
    },

    updatePanelWeightField() {
      const panelWeightElement = document.querySelector(
        "[data-panel-weight-field]"
      );
      if (panelWeightElement && this.currentVariation.panel_weight_kg) {
        panelWeightElement.textContent =
          this.currentVariation.panel_weight_kg + " kg";
      }
    },

    updateDownloadLinks() {
      // Update download links for variation-specific files
      const dataSheetLink = document.querySelector(
        "[data-download-data-sheet]"
      );
      const installationGuideLink = document.querySelector(
        "[data-download-installation-guide]"
      );

      if (dataSheetLink && this.currentVariation.data_sheet_url) {
        dataSheetLink.href = this.currentVariation.data_sheet_url;
      }

      if (
        installationGuideLink &&
        this.currentVariation.installation_guide_url
      ) {
        installationGuideLink.href =
          this.currentVariation.installation_guide_url;
      }
    },

    initializeWooCommerceIntegration() {
      // Add any custom WooCommerce event handlers here
      this.handleAddToCart();
    },

    handleAddToCart() {
      document.addEventListener("added_to_cart", (_event) => {
        // Custom handling after item is added to cart
        // Event detail contains: { productId, quantity, variations }
      });
    },
  }));

  // Coverage Calculator Component
  Alpine.data("coverageCalculator", () => ({
    totalArea: "",
    requiredQuantity: 0,
    productCoverage: 0, // Coverage per unit from product data

    init() {
      this.getProductCoverage();
    },

    getProductCoverage() {
      // Get coverage from product data or custom field
      const coverageElement = document.querySelector("[data-product-coverage]");
      if (coverageElement) {
        this.productCoverage =
          parseFloat(coverageElement.dataset.productCoverage) || 1;
      } else {
        // Default coverage if not specified
        this.productCoverage = 1;
      }
    },

    calculateCoverage() {
      const area = parseFloat(this.totalArea) || 0;

      if (area > 0 && this.productCoverage > 0) {
        this.requiredQuantity = Math.ceil(area / this.productCoverage);
      } else {
        this.requiredQuantity = 0;
      }
    },

    addCalculatedQuantity() {
      if (this.requiredQuantity > 0) {
        // Update the quantity input on the add to cart form
        const quantityInput = document.querySelector('input[name="quantity"]');
        if (quantityInput) {
          quantityInput.value = this.requiredQuantity;

          // Trigger change event to update any listeners
          const event = new Event("change", { bubbles: true });
          quantityInput.dispatchEvent(event);
        }

        // Scroll to add to cart section
        const addToCartSection = document.querySelector(".add-to-cart-section");
        if (addToCartSection) {
          addToCartSection.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Briefly highlight the add to cart button
          const addToCartButton = addToCartSection.querySelector(
            'button[type="submit"]'
          );
          if (addToCartButton) {
            addToCartButton.classList.add("ring-4", "ring-yellow-300");
            setTimeout(() => {
              addToCartButton.classList.remove("ring-4", "ring-yellow-300");
            }, 2000);
          }
        }
      }
    },
  }));

  // Product Image Gallery with Swiper Integration
  Alpine.data("productGallery", () => ({
    mainSwiper: null,
    thumbnailSwiper: null,
    lightboxSwiper: null,
    currentSlide: 0,
    lightboxOpen: false,

    init() {
      this.$nextTick(() => {
        this.initializeSwipers();
      });
    },

    initializeSwipers() {
      // Initialize thumbnail swiper first
      const thumbnailContainer = this.$el.querySelector(".thumbnail-swiper");
      if (thumbnailContainer) {
        this.thumbnailSwiper = new window.Swiper(thumbnailContainer, {
          slidesPerView: "auto",
          spaceBetween: 8,
          freeMode: true,
          watchSlidesProgress: true,
          breakpoints: {
            640: {
              slidesPerView: 4,
              spaceBetween: 12,
            },
            768: {
              slidesPerView: 5,
              spaceBetween: 12,
            },
            1024: {
              slidesPerView: 6,
              spaceBetween: 16,
            },
          },
        });
      }

      // Initialize main image swiper
      const mainContainer = this.$el.querySelector(".main-image-swiper");
      if (mainContainer) {
        this.mainSwiper = new window.Swiper(mainContainer, {
          slidesPerView: 1,
          spaceBetween: 0,
          thumbs: {
            swiper: this.thumbnailSwiper,
          },
          on: {
            slideChange: (swiper) => {
              this.currentSlide = swiper.activeIndex;
            },
          },
        });
      }

      // Initialize lightbox swiper
      const lightboxContainer = this.$el.querySelector(".lightbox-swiper");
      if (lightboxContainer) {
        this.lightboxSwiper = new window.Swiper(lightboxContainer, {
          slidesPerView: 1,
          spaceBetween: 0,
          navigation: {
            nextEl: ".lightbox-swiper .swiper-button-next",
            prevEl: ".lightbox-swiper .swiper-button-prev",
          },
          keyboard: {
            enabled: true,
          },
          on: {
            slideChange: (swiper) => {
              // Sync with main swiper
              if (this.mainSwiper) {
                this.mainSwiper.slideTo(swiper.activeIndex);
              }
            },
          },
        });
      }
    },

    setSlide(index) {
      this.currentSlide = index;
      if (this.mainSwiper) {
        this.mainSwiper.slideTo(index);
      }
    },

    openLightbox(index = null) {
      if (index !== null) {
        this.setSlide(index);
      }
      this.lightboxOpen = true;

      // Sync lightbox with main swiper
      if (this.lightboxSwiper) {
        this.lightboxSwiper.slideTo(this.currentSlide);
      }

      // Prevent body scroll
      document.body.style.overflow = "hidden";
    },

    closeLightbox() {
      this.lightboxOpen = false;

      // Restore body scroll
      document.body.style.overflow = "";
    },

    destroy() {
      // Clean up swipers when component is destroyed
      if (this.mainSwiper) {
        this.mainSwiper.destroy(true, true);
      }
      if (this.thumbnailSwiper) {
        this.thumbnailSwiper.destroy(true, true);
      }
      if (this.lightboxSwiper) {
        this.lightboxSwiper.destroy(true, true);
      }
    },
  }));

  // Product Cart Component (Quantity + Add to Cart)
  Alpine.data("productCart", () => ({
    quantity: 1,
    loading: false,
    canAddToCart: false,
    showSuccess: false,
    successMessage: "",
    selectedSize: null,
    selectedColor: null,
    hasVariations: false,
    selectedVariations: {},

    init() {
      // Check if product has variations
      this.checkForVariations();
      // Listen for variation selection changes
      this.listenForVariationChanges();
      // Initial validation
      this.validateCanAddToCart();
    },

    increaseQuantity() {
      this.quantity++;
      this.updateQuantityInput();
    },

    decreaseQuantity() {
      if (this.quantity > 1) {
        this.quantity--;
        this.updateQuantityInput();
      }
    },

    updateQuantityInput() {
      // Sync with any existing WooCommerce quantity inputs
      const wooQuantityInput = document.querySelector('input[name="quantity"]');
      if (wooQuantityInput && wooQuantityInput !== this.$refs.quantityInput) {
        wooQuantityInput.value = this.quantity;
      }
    },

    async addToCart() {
      // Validate variations before proceeding
      if (!this.canAddToCart) {
        this.showValidationError();
        return;
      }

      this.loading = true;

      try {
        // Get product data
        const productId = this.getProductId();
        const variationData = this.getSelectedVariations();

        // Find variation ID if this is a variable product
        const variationId = this.findVariationId(variationData);

        // Prepare form data - use original working approach
        const formData = new FormData();
        formData.append("add-to-cart", variationId || productId);
        formData.append("quantity", this.quantity);

        // Add variation ID for variable products
        if (variationId) {
          formData.append("variation_id", variationId);
          formData.append("product_id", productId);
        }

        // Add variation data
        Object.entries(variationData).forEach(([key, value]) => {
          formData.append(key, value);
        });

        // Submit to current page (original working approach)
        const response = await fetch(window.location.href, {
          method: "POST",
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          // Trigger WooCommerce added to cart event
          document.body.dispatchEvent(
            new CustomEvent("added_to_cart", {
              detail: {
                productId: productId,
                quantity: this.quantity,
                variations: variationData,
              },
            })
          );

          // Update cart badge
          this.updateCartBadge();

          // Show success feedback
          this.showSuccessMessage();
        } else {
          throw new Error("Failed to add to cart");
        }
      } catch (error) {
        console.error("Add to cart error:", error);
        // Handle add to cart error silently
        this.showErrorMessage();
      } finally {
        this.loading = false;
      }
    },

    getProductId() {
      // Try data attribute from the component element first
      const componentElement = this.$el;
      if (componentElement?.dataset.productId) {
        return componentElement.dataset.productId;
      }
      
      // Try hidden input
      const hiddenInput = document.querySelector('input[name="add-to-cart"]');
      if (hiddenInput?.value) {
        return hiddenInput.value;
      }
      
      // Try WooCommerce form
      const form = document.querySelector(".variations_form, .cart");
      if (form) {
        const formProductId = form.dataset.product_id || form.querySelector('[name="add-to-cart"]')?.value;
        if (formProductId) {
          return formProductId;
        }
      }
      
      // Try window params as fallback
      return window.wc_add_to_cart_params?.product_id || 
             window.wc_single_product_params?.product_id || 
             "";
    },

    getSelectedVariations() {
      const variations = {};

      // Use all tracked variation values
      Object.entries(this.selectedVariations).forEach(([attribute, value]) => {
        if (value) {
          variations[`attribute_${attribute}`] = value;
        }
      });

      // Also check for hidden inputs as fallback
      const hiddenInputs = document.querySelectorAll(
        'input[name^="attribute_"]'
      );
      hiddenInputs.forEach((input) => {
        if (input.value && !variations[input.name]) {
          variations[input.name] = input.value;
        }
      });

      return variations;
    },

    findVariationId(selectedVariations) {
      // Get variation data from the page
      const variationScript = document.querySelector("script[data-variations]");
      if (!variationScript) return null;

      try {
        const variations = JSON.parse(variationScript.dataset.variations);

        // Find matching variation based on selected attributes
        const matchingVariation = variations.find((variation) => {
          if (!variation.attributes || !selectedVariations) return false;

          // Check if all selected attributes match this variation
          return Object.entries(selectedVariations).every(([attr, value]) => {
            const variationValue = variation.attributes[attr];

            // Handle empty variation attributes (means any value)
            if (variationValue === "" || variationValue === null) return true;

            return variationValue.toLowerCase() === value.toLowerCase();
          });
        });

        return matchingVariation ? matchingVariation.variation_id : null;
      } catch (e) {
        console.error("Error parsing variation data:", e);
        return null;
      }
    },

    showSuccessMessage() {
      // Show success message next to add to cart button
      this.showSuccess = true;
      this.successMessage = "Product added to cart";

      // After 2 seconds, change to "View Cart" message
      setTimeout(() => {
        if (this.showSuccess) {
          this.successMessage = "View Cart";
        }
      }, 2000);

      // Hide success message after 8 seconds total (6 seconds for "View Cart")
      setTimeout(() => {
        this.showSuccess = false;
        this.successMessage = "";
      }, 8000);
    },

    showErrorMessage() {
      // You can customize this error feedback
      alert("Failed to add product to cart. Please try again.");
    },

    showValidationError() {
      // Show validation message for missing variations
      const missingVariations = [];

      // Check all variation elements
      const allVariationElements = document.querySelectorAll(
        '[x-data*="sizeDropdown"], [x-data*="colorSelection"]'
      );

      allVariationElements.forEach((element) => {
        const attributeName = element.dataset.attribute || "size";
        const label =
          element.querySelector("label")?.textContent?.trim() || attributeName;

        if (!this.selectedVariations[attributeName]) {
          missingVariations.push(label.toLowerCase());
        }
      });

      if (missingVariations.length > 0) {
        const variationText = missingVariations.join(" and ");
        alert(`Please select a ${variationText} before adding to cart.`);
      }
    },

    checkForVariations() {
      // Check if product has any variations (size, color, or generic)
      const sizeDropdown = document.querySelector('[x-data*="sizeDropdown"]');
      const colorSelection = document.querySelector(
        '[x-data*="colorSelection"]'
      );
      const genericVariations = document.querySelectorAll(
        ".generic-variation-selection"
      );

      this.hasVariations = !!(
        sizeDropdown ||
        colorSelection ||
        genericVariations.length > 0
      );

      // If no variations, allow add to cart
      if (!this.hasVariations) {
        this.canAddToCart = true;
      }
    },

    listenForVariationChanges() {
      // Listen for variation changes from all variation components
      document.addEventListener("variation-changed", (event) => {
        const attribute = event.detail.attribute;
        const value = event.detail.value;

        // Update tracked variations
        this.selectedVariations[attribute] = value;

        // Also update specific properties for size and color for backward compatibility
        if (attribute === "size") {
          this.selectedSize = value;
        } else if (attribute === "colour") {
          this.selectedColor = value;
        }

        this.validateCanAddToCart();
      });
    },

    validateCanAddToCart() {
      if (!this.hasVariations) {
        this.canAddToCart = true;
        return;
      }

      let canAdd = true;

      // Check all variation dropdowns
      const allVariationElements = document.querySelectorAll(
        '[x-data*="sizeDropdown"], [x-data*="colorSelection"]'
      );

      allVariationElements.forEach((element) => {
        const attributeName = element.dataset.attribute || "size";

        // Check if this variation has a value selected
        if (!this.selectedVariations[attributeName]) {
          canAdd = false;
        }
      });

      this.canAddToCart = canAdd;
    },

    async updateCartBadge() {
      // Try to get the actual cart count from WooCommerce API
      try {
        const response = await fetch("/wp-json/wc/store/cart", {
          credentials: "same-origin",
        });
        if (response.ok) {
          const data = await response.json();
          const actualCartCount = data.items_count || 0;

          // Trigger cart update event with actual count
          document.dispatchEvent(
            new CustomEvent("cart-updated", {
              detail: {
                cartCount: actualCartCount,
                addedQuantity: this.quantity,
              },
            })
          );
          return;
        }
      } catch (error) {
        // Could not fetch actual cart count, using fallback
      }

      // Fallback: increment current count
      const existingBadge = document.querySelector(".cart-badge");
      let currentCount = Alpine.store("initialCartCount") || 0;

      if (existingBadge && existingBadge.textContent) {
        currentCount = parseInt(existingBadge.textContent) || 0;
      }

      const newCount = currentCount + this.quantity;

      // Trigger cart update event
      document.dispatchEvent(
        new CustomEvent("cart-updated", {
          detail: {
            cartCount: newCount,
            addedQuantity: this.quantity,
          },
        })
      );
    },

    get addToCartButtonClasses() {
      return {
        "hover:bg-yellow-300": !this.loading && this.canAddToCart,
        "opacity-75": this.loading,
        "opacity-50": !this.loading && !this.canAddToCart,
        "cursor-not-allowed": !this.canAddToCart,
      };
    },
  }));

  // Size Dropdown Component
  Alpine.data("sizeDropdown", () => ({
    isOpen: false,
    selectedSize: null,
    sizeOptions: [],
    attributeName: "size",

    init() {
      // Get attribute name from data attribute
      this.attributeName = this.$el.dataset.attribute || "size";
      this.loadSizeOptions();
    },

    loadSizeOptions() {
      // First try to load from data attribute
      const sizesAttr = this.$el.dataset.sizes;
      if (sizesAttr) {
        try {
          const sizeData = JSON.parse(sizesAttr);
          if (Array.isArray(sizeData) && sizeData.length > 0) {
            this.sizeOptions = sizeData.map((size) => ({
              value: size.trim(), // Keep original value, don't convert to slug
              name: size.trim(),
              available: true,
            }));
            return;
          }
        } catch (e) {
          // Silently handle parsing errors
        }
      }

      // Fallback: Try to load from WooCommerce variation data
      const variationForm = document.querySelector(".variations_form");
      if (variationForm && variationForm.dataset.product_variations) {
        try {
          const variations = JSON.parse(
            variationForm.dataset.product_variations
          );
          const sizeOptionsMap = new Map();

          variations.forEach((variation) => {
            if (variation.attributes) {
              Object.keys(variation.attributes).forEach((attr) => {
                if (attr.toLowerCase().includes("size")) {
                  const value = variation.attributes[attr];
                  if (value && value !== "") {
                    const key = value.toLowerCase();
                    if (!sizeOptionsMap.has(key)) {
                      sizeOptionsMap.set(key, {
                        value: value, // Keep original value, don't convert to slug
                        name: value,
                        available: true,
                      });
                    }
                    if (variation.is_in_stock) {
                      sizeOptionsMap.get(key).available = true;
                    }
                  }
                }
              });
            }
          });

          if (sizeOptionsMap.size > 0) {
            this.sizeOptions = Array.from(sizeOptionsMap.values());
            return;
          }
        } catch (e) {
          // Silently handle parsing errors
        }
      }

      this.sizeOptions = [];
    },

    toggleOpen() {
      this.isOpen = !this.isOpen;
    },

    closeDropdown() {
      this.isOpen = false;
    },

    selectSize(option) {
      if (option.available) {
        this.selectedSize = option;
        this.isOpen = false;

        // Update hidden input
        if (this.$refs.sizeInput) {
          this.$refs.sizeInput.value = option.value;
        }

        // Trigger variation change event
        this.triggerVariationChange();
      }
    },

    triggerVariationChange() {
      // Notify parent component of variation change
      const event = new CustomEvent("variation-changed", {
        detail: {
          attribute: this.attributeName,
          value: this.selectedSize?.value,
        },
      });
      document.dispatchEvent(event);
    },
  }));

  // Color Selection Component
  Alpine.data("colorSelection", () => ({
    selectedColor: null,
    colorOptions: [],

    init() {
      this.loadColorOptions();
    },

    loadColorOptions() {
      // First try to load from data attribute
      const colorsAttr = this.$el.dataset.colors;
      if (colorsAttr) {
        try {
          const colorData = JSON.parse(colorsAttr);
          if (Array.isArray(colorData) && colorData.length > 0) {
            this.colorOptions = colorData.map((color) => ({
              value: color.trim(), // Keep original value, don't convert to slug
              name: color.trim(),
              hex: this.getColorHex(color.trim()),
              available: true,
            }));
            return;
          }
        } catch (e) {
          // Silently handle parsing errors
        }
      }

      // Fallback: Try to load from WooCommerce variation data
      const variationForm = document.querySelector(".variations_form");
      if (variationForm && variationForm.dataset.product_variations) {
        try {
          const variations = JSON.parse(
            variationForm.dataset.product_variations
          );
          const colorOptionsMap = new Map();

          variations.forEach((variation) => {
            if (variation.attributes) {
              Object.keys(variation.attributes).forEach((attr) => {
                if (
                  attr.toLowerCase().includes("color") ||
                  attr.toLowerCase().includes("colour")
                ) {
                  const value = variation.attributes[attr];
                  if (value && value !== "") {
                    const key = value.toLowerCase();
                    if (!colorOptionsMap.has(key)) {
                      colorOptionsMap.set(key, {
                        value: value, // Keep original value, don't convert to slug
                        name: value,
                        hex: this.getColorHex(value),
                        available: false,
                      });
                    }
                    if (variation.is_in_stock) {
                      colorOptionsMap.get(key).available = true;
                    }
                  }
                }
              });
            }
          });

          if (colorOptionsMap.size > 0) {
            this.colorOptions = Array.from(colorOptionsMap.values());
            return;
          }
        } catch (e) {
          // Silently handle parsing errors
        }
      }

      this.colorOptions = [];
    },

    getColorHex(colorName) {
      // Map color names to hex values
      const colorMap = {
        red: "#DC2626",
        blue: "#2563EB",
        green: "#16A34A",
        black: "#000000",
        white: "#FFFFFF",
        yellow: "#EAB308",
        purple: "#9333EA",
        pink: "#EC4899",
        gray: "#6B7280",
        grey: "#6B7280",
      };

      return colorMap[colorName.toLowerCase()] || "#9CA3AF";
    },

    selectColor(color) {
      if (!color.available) return;

      // Single selection - set or clear
      if (this.selectedColor === color.value) {
        this.selectedColor = null; // Deselect if clicking the same color
      } else {
        this.selectedColor = color.value;
      }

      // Update hidden input
      if (this.$refs.colorInput) {
        this.$refs.colorInput.value = this.selectedColor || "";
      }

      this.triggerVariationChange();
    },

    triggerVariationChange() {
      // Notify parent component of variation change
      const event = new CustomEvent("variation-changed", {
        detail: { attribute: "colour", value: this.selectedColor },
      });
      document.dispatchEvent(event);
    },
  }));

  // Product Card Cart Component (for Simple Products)
  Alpine.data("productCardCart", () => ({
    loading: false,
    showSuccess: false,
    successMessage: "",
    isViewCartLink: false,

    async addToCart(productId) {
      this.loading = true;

      try {
        // Use WooCommerce AJAX endpoint for add to cart
        const ajaxUrl = window.wc_add_to_cart_params?.ajax_url || '/wp-admin/admin-ajax.php';
        
        // Prepare form data
        const formData = new FormData();
        formData.append("action", "woocommerce_add_to_cart");
        formData.append("product_id", productId);
        formData.append("quantity", 1);

        // Submit to WooCommerce AJAX endpoint
        const response = await fetch(ajaxUrl, {
          method: "POST",
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          const responseText = await response.text();
          
          // Check if the response contains error
          if (responseText.includes('error') || responseText === '0') {
            throw new Error("WooCommerce add to cart failed");
          }

          // Update cart badge
          await this.updateCartBadge();

          // Show success feedback
          this.showSuccessMessage();
        } else {
          throw new Error("Failed to add to cart");
        }
      } catch (error) {
        console.error("Product card add to cart error:", error);
        // Handle add to cart error silently
        this.showErrorMessage();
      } finally {
        this.loading = false;
      }
    },

    showSuccessMessage() {
      // Show success message next to add to cart button
      this.showSuccess = true;
      this.successMessage = "Added!";
      this.isViewCartLink = false;

      // After 2 seconds, change to "View Cart" message
      setTimeout(() => {
        if (this.showSuccess) {
          this.successMessage = "View Cart";
          this.isViewCartLink = true;
        }
      }, 2000);

      // Hide success message after 8 seconds total (6 seconds for "View Cart")
      setTimeout(() => {
        this.showSuccess = false;
        this.successMessage = "";
        this.isViewCartLink = false;
      }, 8000);
    },

    goToCart() {
      if (this.isViewCartLink) {
        window.location.href = this.getCartUrl();
      }
    },

    getCartUrl() {
      // Try to get cart URL from WooCommerce
      return window.wc_cart_params?.cart_url || "/cart";
    },

    showErrorMessage() {
      // You can customize this error feedback
      alert("Failed to add product to cart. Please try again.");
    },

    async updateCartBadge() {
      // Try to get the actual cart count from WooCommerce API
      try {
        const response = await fetch("/wp-json/wc/store/cart", {
          credentials: "same-origin",
        });
        if (response.ok) {
          const data = await response.json();
          const actualCartCount = data.items_count || 0;

          // Trigger cart update event with actual count
          document.dispatchEvent(
            new CustomEvent("cart-updated", {
              detail: {
                cartCount: actualCartCount,
                addedQuantity: 1,
              },
            })
          );
          return;
        }
      } catch (error) {
        // Could not fetch actual cart count, using fallback
      }

      // Fallback: increment current count
      const existingBadge = document.querySelector(".cart-badge");
      let currentCount = Alpine.store("initialCartCount") || 0;

      if (existingBadge && existingBadge.textContent) {
        currentCount = parseInt(existingBadge.textContent) || 0;
      }

      const newCount = currentCount + 1;

      // Trigger cart update event
      document.dispatchEvent(
        new CustomEvent("cart-updated", {
          detail: {
            cartCount: newCount,
            addedQuantity: 1,
          },
        })
      );
    },

    get addToCartButtonClasses() {
      return {
        "hover:bg-yellow-300": !this.loading,
        "opacity-75": this.loading,
        "cursor-wait": this.loading,
      };
    },
  }));

  // Cart Badge Component
  Alpine.data("cartBadge", () => ({
    cartCount: 0,

    init() {
      // Initialize from data attribute (server-side count)
      const initialCount = parseInt(this.$el.dataset.initialCount) || 0;
      this.cartCount = initialCount;

      // Listen for cart update events
      document.addEventListener("cart-updated", (event) => {
        if (event.detail && event.detail.cartCount !== undefined) {
          this.cartCount = event.detail.cartCount;
        } else {
          // Fallback: try to get cart count from WooCommerce
          this.fetchCartCount();
        }
      });

      // Listen for WooCommerce cart events (cart page updates)
      document.addEventListener("wc_fragments_refreshed", () => {
        this.fetchCartCount();
      });

      // Listen for cart item removal (WooCommerce native events)
      document.addEventListener("removed_from_cart", () => {
        this.fetchCartCount();
      });

      // Listen for cart quantity changes
      document.addEventListener("updated_cart_totals", () => {
        this.fetchCartCount();
      });

      // Set up cart page monitoring
      if (this.isCartPage()) {
        this.startCartPagePolling();
        this.setupCartPageObserver();
      }

      // Listen for AJAX complete events (for cart updates)
      if (typeof jQuery !== "undefined") {
        jQuery(document).ajaxComplete((_event, _xhr, settings) => {
          // Check if the AJAX request was cart-related
          if (
            settings.url &&
            (settings.url.includes("wc-ajax=update_shipping_method") ||
              settings.url.includes("wc-ajax=apply_coupon") ||
              settings.url.includes("wc-ajax=remove_coupon") ||
              settings.url.includes("update-cart") ||
              settings.url.includes("cart"))
          ) {
            setTimeout(() => this.fetchCartCount(), 500);
          }
        });
      }
    },

    updateCartCount() {
      // Get current cart count from the existing badge
      const existingBadge = document.querySelector(".cart-badge");
      if (existingBadge) {
        const currentCount = parseInt(existingBadge.textContent) || 0;
        this.cartCount = currentCount;
      }
    },

    async fetchCartCount() {
      // Try to get cart count via AJAX if available
      try {
        const response = await fetch("/wp-json/wc/store/cart", {
          credentials: "same-origin",
        });
        if (response.ok) {
          const data = await response.json();
          this.cartCount = data.items_count || 0;
        }
      } catch (error) {
        console.log("Could not fetch cart count:", error);
      }
    },

    get showBadge() {
      return this.cartCount > 0;
    },

    isCartPage() {
      // Check if we're on the cart page
      return (
        window.location.pathname.includes("/cart") ||
        document.body.classList.contains("woocommerce-cart") ||
        document.querySelector(".woocommerce-cart") !== null
      );
    },

    startCartPagePolling() {
      // Poll for cart changes every 2 seconds when on cart page
      setInterval(() => {
        this.fetchCartCount();
      }, 2000);
    },

    setupCartPageObserver() {
      // Watch for changes in cart items
      const cartTable = document.querySelector(
        ".woocommerce-cart-form, .cart-collaterals, .woocommerce-cart"
      );
      if (cartTable) {
        const observer = new MutationObserver(() => {
          // Delay to allow DOM updates to complete
          setTimeout(() => this.fetchCartCount(), 300);
        });

        observer.observe(cartTable, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class"],
        });
      }
    },
  }));
});
