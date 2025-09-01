// Alpine.js Single Product Components

document.addEventListener("alpine:init", () => {
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
      document.addEventListener("added_to_cart", (event) => {
        // Custom handling after item is added to cart
        console.log("Product added to cart:", event.detail);
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

        // Prepare form data
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

        // Submit to WooCommerce
        const response = await fetch(window.location.href, {
          method: "POST",
          body: formData,
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

          // Show success feedback
          this.showSuccessMessage();
        } else {
          throw new Error("Failed to add to cart");
        }
      } catch (error) {
        // Handle add to cart error silently
        this.showErrorMessage();
      } finally {
        this.loading = false;
      }
    },

    getProductId() {
      // Get product ID from various sources
      const form = document.querySelector(".variations_form, .cart");
      if (form) {
        return (
          form.dataset.product_id ||
          form.querySelector('[name="add-to-cart"]')?.value
        );
      }
      return window.wc_add_to_cart_params?.product_id || "";
    },

    getSelectedVariations() {
      const variations = {};

      // Use tracked variation values from our validation logic
      if (this.selectedSize) {
        variations["attribute_size"] = this.selectedSize;
      }

      if (this.selectedColor) {
        variations["attribute_colour"] = this.selectedColor;
      }

      // Also check for hidden inputs as fallback
      const sizeInput = document.querySelector('[name="attribute_size"]');
      if (sizeInput && sizeInput.value && !variations["attribute_size"]) {
        variations["attribute_size"] = sizeInput.value;
      }

      const colorInput = document.querySelector('[name="attribute_colour"]');
      if (colorInput && colorInput.value && !variations["attribute_colour"]) {
        variations["attribute_colour"] = colorInput.value;
      }

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
        console.error('Error parsing variation data:', e);
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
      
      const sizeDropdown = document.querySelector('[x-data*="sizeDropdown"]');
      const colorSelection = document.querySelector('[x-data*="colorSelection"]');
      
      if (sizeDropdown && !this.selectedSize) {
        missingVariations.push("size");
      }
      
      if (colorSelection && !this.selectedColor) {
        missingVariations.push("color");
      }
      
      if (missingVariations.length > 0) {
        const variationText = missingVariations.join(" and ");
        alert(`Please select a ${variationText} before adding to cart.`);
      }
    },

    checkForVariations() {
      // Check if product has size or color variations
      const sizeDropdown = document.querySelector('[x-data*="sizeDropdown"]');
      const colorSelection = document.querySelector('[x-data*="colorSelection"]');
      this.hasVariations = !!(sizeDropdown || colorSelection);
      
      // If no variations, allow add to cart
      if (!this.hasVariations) {
        this.canAddToCart = true;
      }
    },

    listenForVariationChanges() {
      // Listen for variation changes from size and color components
      document.addEventListener("variation-changed", (event) => {
        if (event.detail.attribute === "size") {
          this.selectedSize = event.detail.value;
        } else if (event.detail.attribute === "colour") {
          this.selectedColor = event.detail.value;
        }
        this.validateCanAddToCart();
      });
    },

    validateCanAddToCart() {
      if (!this.hasVariations) {
        this.canAddToCart = true;
        return;
      }

      // Check if we have size and color dropdowns
      const sizeDropdown = document.querySelector('[x-data*="sizeDropdown"]');
      const colorSelection = document.querySelector('[x-data*="colorSelection"]');
      
      let canAdd = true;
      
      // If size dropdown exists, require size selection
      if (sizeDropdown && !this.selectedSize) {
        canAdd = false;
      }
      
      // If color selection exists, require color selection
      if (colorSelection && !this.selectedColor) {
        canAdd = false;
      }
      
      this.canAddToCart = canAdd;
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

    init() {
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
        detail: { attribute: "size", value: this.selectedSize?.value },
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
        this.$refs.colorInput.value = this.selectedColor || '';
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
});
