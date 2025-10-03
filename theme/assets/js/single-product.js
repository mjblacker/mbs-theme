document.addEventListener("alpine:init", () => {
  const ProductUtils = {
    selectors: {
      variationForm: '.variations_form',
      priceElement: '.product-price',
      quantityInput: 'input[name="quantity"]',
      cartForm: '.woocommerce-cart-form, .cart',
      cartBadge: '.cart-badge'
    },

    endpoints: {
      cart: window.wpEndpoints?.cartApiUrl || '/wp-json/wc/store/cart',
      ajax: window.wpEndpoints?.ajaxUrl || '/wp-admin/admin-ajax.php'
    },

    async updateCartBadge(addedQuantity = 1) {
      try {
        const response = await fetch(this.endpoints.cart, { credentials: 'same-origin' });
        if (response.ok) {
          const data = await response.json();
          document.dispatchEvent(new CustomEvent('cart-updated', {
            detail: { cartCount: data.items_count || 0, addedQuantity }
          }));
          return;
        }
      } catch (error) {
        console.log('Could not fetch cart count:', error);
      }

      const existingBadge = document.querySelector(this.selectors.cartBadge);
      const currentCount = parseInt(existingBadge?.textContent) || 0;
      document.dispatchEvent(new CustomEvent('cart-updated', {
        detail: { cartCount: currentCount + addedQuantity, addedQuantity }
      }));
    },

    getVariationData() {
      const form = document.querySelector(this.selectors.variationForm);
      if (form?.dataset.product_variations) {
        try {
          return JSON.parse(form.dataset.product_variations);
        } catch (e) {
          console.error('Error parsing variation data:', e);
          return null;
        }
      }

      const variationScript = document.querySelector("script[data-variations]");
      if (variationScript) {
        try {
          return JSON.parse(variationScript.dataset.variations);
        } catch (e) {
          console.error('Error parsing script variation data:', e);
          return null;
        }
      }

      return null;
    },

    formatPrice(price) {
      const currency = window.woocommerce_currency || '$';
      return `<span class="woocommerce-Price-amount amount">${currency}${parseFloat(price).toFixed(2)}</span>`;
    }
  };

  Alpine.data("singleProduct", () => ({
    currentVariation: null,
    selectedAttributes: {},
    originalPrice: null,

    init() {
      this.setupPriceElements();
      this.setupEventListeners();
    },

    setupPriceElements() {
      const priceElement = document.querySelector(ProductUtils.selectors.priceElement);
      if (priceElement) {
        this.originalPrice = priceElement.innerHTML;
      }
    },

    setupEventListeners() {
      document.addEventListener("variation-changed", (event) => {
        this.selectedAttributes[event.detail.attribute] = event.detail.value;
        this.findMatchingVariation();
      });

      document.addEventListener("found_variation", (event) => {
        this.currentVariation = event.detail.variation;
        this.updatePrice(event.detail.variation);
        this.updateCustomFields();
      });

      document.addEventListener("reset_data", () => {
        this.currentVariation = null;
        this.resetPrice();
      });
    },

    findMatchingVariation() {
      const variationData = ProductUtils.getVariationData();
      
      if (!variationData?.length) return;

      const matchingVariation = variationData.find((variation) => {
        if (!variation.attributes) return false;
        
        return Object.entries(this.selectedAttributes).every(([attr, value]) => {
          if (!value) return true;
          const attrKey = `attribute_${attr}`;
          const variationValue = variation.attributes[attrKey];
          
          if (variationValue === "" || variationValue === null) return true;
          return variationValue.toLowerCase() === value.toLowerCase();
        });
      });

      if (matchingVariation) {
        this.currentVariation = matchingVariation;
        this.updatePrice(matchingVariation);
        this.updateCustomFields();
        
        document.dispatchEvent(new CustomEvent("found_variation", {
          detail: { variation: matchingVariation }
        }));
      } else {
        this.resetPrice();
        this.currentVariation = null;
      }
    },

    updatePrice(variation) {
      const priceElement = document.querySelector(ProductUtils.selectors.priceElement);
      if (!priceElement || !variation) return;

      const salePrice = parseFloat(variation.display_price);
      const regularPrice = parseFloat(variation.display_regular_price);

      let priceHtml = "";
      
      if (variation.price_html && !regularPrice) {
        priceHtml = variation.price_html + '<span class="text-sm text-gray-500 font-normal ml-2">INC GST</span>';
      } else if (salePrice) {
        const formattedSale = ProductUtils.formatPrice(salePrice);
        
        if (regularPrice && regularPrice > salePrice) {
          const formattedRegular = ProductUtils.formatPrice(regularPrice);
          const savingsPercent = Math.round(((regularPrice - salePrice) / regularPrice) * 100);
          
          priceHtml = `
            <div class="flex items-center gap-3 flex-wrap">
              <div class="text-2xl font-bold text-gray-900">${formattedSale}</div>
              <div class="text-lg text-gray-500 line-through">${formattedRegular}</div>
              <span class="text-sm text-gray-500 font-normal">INC GST</span>
              <div class="bg-green-600 text-white px-2 py-1 rounded text-sm font-medium">-${savingsPercent}%</div>
            </div>`;
        } else {
          priceHtml = `
            <div class="flex items-center gap-3">
              <div class="text-2xl font-bold text-gray-900">${formattedSale}</div>
              <span class="text-sm text-gray-500 font-normal">INC GST</span>
            </div>`;
        }
      }

      if (priceHtml) {
        priceElement.innerHTML = priceHtml;
      }
    },

    resetPrice() {
      const priceElement = document.querySelector(ProductUtils.selectors.priceElement);
      if (priceElement && this.originalPrice) {
        priceElement.innerHTML = this.originalPrice;
      }
    },

    updateCustomFields() {
      if (!this.currentVariation) return;
      
      const fields = [
        { selector: '[data-coverage-field]', key: 'coverage_m2', suffix: ' M²' },
        { selector: '[data-panel-weight-field]', key: 'panel_weight_kg', suffix: ' kg' }
      ];
      
      fields.forEach(({ selector, key, suffix }) => {
        const element = document.querySelector(selector);
        if (element && this.currentVariation[key]) {
          element.textContent = this.currentVariation[key] + suffix;
        }
      });

      const links = [
        { selector: '[data-download-data-sheet]', key: 'data_sheet_url' },
        { selector: '[data-download-installation-guide]', key: 'installation_guide_url' }
      ];
      
      links.forEach(({ selector, key }) => {
        const element = document.querySelector(selector);
        if (element && this.currentVariation[key]) {
          element.href = this.currentVariation[key];
        }
      });
    }
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

  Alpine.data("productCart", () => ({
    quantity: 1,
    loading: false,
    canAddToCart: true,
    showSuccess: false,
    successMessage: "",
    selectedVariations: {},

    init() {
      this.setupEventListeners();
      this.validateCanAddToCart();
    },

    setupEventListeners() {
      document.addEventListener("variation-changed", (event) => {
        this.selectedVariations[event.detail.attribute] = event.detail.value;
        this.validateCanAddToCart();
      });
    },

    increaseQuantity() {
      this.quantity++;
      this.syncQuantityInput();
    },

    decreaseQuantity() {
      if (this.quantity > 1) {
        this.quantity--;
        this.syncQuantityInput();
      }
    },

    syncQuantityInput() {
      const quantityInput = document.querySelector(ProductUtils.selectors.quantityInput);
      if (quantityInput && quantityInput !== this.$refs.quantityInput) {
        quantityInput.value = this.quantity;
      }
    },

    async addToCart() {
      if (!this.canAddToCart) {
        this.showValidationError();
        return;
      }

      this.loading = true;

      try {
        const productId = this.getProductId();
        const variationData = this.getSelectedVariations();
        const variationId = this.findVariationId(variationData);

        const formData = new FormData();
        formData.append("add-to-cart", variationId || productId);
        formData.append("quantity", this.quantity);

        if (variationId) {
          formData.append("variation_id", variationId);
          formData.append("product_id", productId);
        }

        Object.entries(variationData).forEach(([key, value]) => {
          formData.append(key, value);
        });

        const response = await fetch(window.location.href, {
          method: "POST",
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          await ProductUtils.updateCartBadge(this.quantity);
          this.showSuccessMessage();
        } else {
          throw new Error("Failed to add to cart");
        }
      } catch (error) {
        console.error("Add to cart error:", error);
        alert("Failed to add product to cart. Please try again.");
      } finally {
        this.loading = false;
      }
    },

    getProductId() {
      return this.$el?.dataset.productId ||
             document.querySelector('input[name="add-to-cart"]')?.value ||
             document.querySelector(ProductUtils.selectors.cartForm)?.dataset.product_id ||
             "";
    },

    getSelectedVariations() {
      const variations = {};
      
      // Only include explicitly selected variations
      Object.entries(this.selectedVariations).forEach(([attribute, value]) => {
        if (value) variations[`attribute_${attribute}`] = value;
      });
      
      // Don't automatically include hidden inputs with default values
      // Only include hidden inputs that correspond to explicitly selected variations
      document.querySelectorAll('input[name^="attribute_"]').forEach((input) => {
        const attributeName = input.name.replace('attribute_', '');
        // Only include if we have explicitly selected this attribute
        if (input.value && this.selectedVariations[attributeName] && !variations[input.name]) {
          variations[input.name] = input.value;
        }
      });
      
      
      return variations;
    },

    findVariationId(selectedVariations) {
      const variationData = ProductUtils.getVariationData();
      if (!variationData) return null;

      const matchingVariation = variationData.find((variation) => {
        if (!variation.attributes || !selectedVariations) return false;
        
        return Object.entries(selectedVariations).every(([attr, value]) => {
          const variationValue = variation.attributes[attr];
          if (variationValue === "" || variationValue === null) return true;
          return variationValue.toLowerCase() === value.toLowerCase();
        });
      });

      return matchingVariation?.variation_id || null;
    },

    showSuccessMessage() {
      this.showSuccess = true;
      this.successMessage = "Product added to cart";

      setTimeout(() => {
        if (this.showSuccess) this.successMessage = "View Cart";
      }, 2000);

      setTimeout(() => {
        this.showSuccess = false;
        this.successMessage = "";
      }, 8000);
    },

    showValidationError() {
      const missingVariations = [];
      document.querySelectorAll('[x-data*="sizeDropdown"], [x-data*="colorSelection"], [x-data*="variationDropdown"], [class*="variation-selector"]').forEach((element) => {
        let attributeName = element.dataset.attribute;
        
        // Determine attribute name based on component type if not explicitly set
        if (!attributeName) {
          const xData = element.getAttribute('x-data') || '';
          if (xData.includes('sizeDropdown')) {
            attributeName = 'size';
          } else if (xData.includes('colorSelection')) {
            attributeName = 'colour';
          } else if (xData.includes('variationDropdown')) {
            attributeName = element.dataset.variationAttribute || 'variation';
          }
        }
        
        if (!this.selectedVariations[attributeName]) {
          const label = element.querySelector("label")?.textContent?.trim() || 
                       element.dataset.label || 
                       attributeName.charAt(0).toUpperCase() + attributeName.slice(1);
          missingVariations.push(label.toLowerCase());
        }
      });

      if (missingVariations.length > 0) {
        alert(`Please select a ${missingVariations.join(" and ")} before adding to cart.`);
      }
    },

    validateCanAddToCart() {
      const variationElements = document.querySelectorAll('[x-data*="sizeDropdown"], [x-data*="colorSelection"], [x-data*="variationDropdown"], [class*="variation-selector"]');
      
      if (variationElements.length === 0) {
        this.canAddToCart = true;
        return;
      }

      const allSelected = Array.from(variationElements).every((element) => {
        let attributeName = element.dataset.attribute;
        
        // Determine attribute name based on component type if not explicitly set
        if (!attributeName) {
          const xData = element.getAttribute('x-data') || '';
          if (xData.includes('sizeDropdown')) {
            attributeName = 'size';
          } else if (xData.includes('colorSelection')) {
            attributeName = 'colour'; // Note: colorSelection uses 'colour'
          } else if (xData.includes('variationDropdown')) {
            // For generic variation dropdowns, try to infer from element or use a default
            attributeName = element.dataset.variationAttribute || 'variation';
          }
        }
        
        return !!this.selectedVariations[attributeName];
      });

      this.canAddToCart = allSelected;
    },

    get addToCartButtonClasses() {
      return {
        "hover:bg-yellow-300": !this.loading && this.canAddToCart,
        "opacity-75": this.loading,
        "opacity-50": !this.loading && !this.canAddToCart,
        "cursor-not-allowed": !this.canAddToCart,
      };
    }
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

  Alpine.data("productCardCart", () => ({
    loading: false,
    showSuccess: false,
    successMessage: "",
    isViewCartLink: false,

    async addToCart(productId) {
      this.loading = true;

      try {
        const formData = new FormData();
        formData.append("action", "woocommerce_add_to_cart");
        formData.append("product_id", productId);
        formData.append("quantity", 1);

        const response = await fetch(ProductUtils.endpoints.ajax, {
          method: "POST",
          body: formData,
          credentials: 'same-origin'
        });

        if (response.ok) {
          const responseText = await response.text();

          if (responseText.includes('error') || responseText === '0') {
            throw new Error("Add to cart failed");
          }

          await ProductUtils.updateCartBadge(1);

          // If on cart page, reload to show new item
          if (window.location.pathname.includes('/cart')) {
            window.location.reload();
          } 
          
        } else {
          throw new Error("Failed to add to cart");
        }
      } catch (error) {
        console.error("Product card add to cart error:", error);
        alert("Failed to add product to cart. Please try again.");
      } finally {
        this.loading = false;
      }
    },

    showSuccessMessage() {
      this.showSuccess = true;
      this.successMessage = "Added!";
      this.isViewCartLink = false;

      setTimeout(() => {
        if (this.showSuccess) {
          this.successMessage = "View Cart";
          this.isViewCartLink = true;
        }
      }, 2000);

      setTimeout(() => {
        this.showSuccess = false;
        this.successMessage = "";
        this.isViewCartLink = false;
      }, 8000);
    },

    goToCart() {
      if (this.isViewCartLink) {
        window.location.href = window.wc_cart_params?.cart_url || "/cart";
      }
    },

    get addToCartButtonClasses() {
      return {
        "hover:bg-yellow-300": !this.loading,
        "opacity-75": this.loading,
        "cursor-wait": this.loading,
      };
    }
  }));

  Alpine.data("cartBadge", () => ({
    cartCount: 0,

    init() {
      this.cartCount = parseInt(this.$el.dataset.initialCount) || 0;
      this.setupEventListeners();
    },

    setupEventListeners() {
      document.addEventListener("cart-updated", (event) => {
        if (event.detail?.cartCount !== undefined) {
          this.cartCount = event.detail.cartCount;
        }
      });

      const cartEvents = ['wc_fragments_refreshed', 'removed_from_cart', 'updated_cart_totals'];
      cartEvents.forEach(eventName => {
        document.addEventListener(eventName, () => this.fetchCartCount());
      });
    },

    async fetchCartCount() {
      try {
        const response = await fetch(ProductUtils.endpoints.cart, { credentials: "same-origin" });
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
    }
  }));
});
