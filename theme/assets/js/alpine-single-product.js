// Alpine.js Single Product Components

document.addEventListener("alpine:init", () => {
  // Single Product Main Component
  Alpine.data("singleProduct", () => ({
    hasVariations: false,
    currentVariation: null,
    selectedAttributes: {},

    init() {
      this.detectVariations();
      this.initializeWooCommerceIntegration();
    },

    detectVariations() {
      // Check if product has variations
      const variationForm = document.querySelector('.variations_form');
      this.hasVariations = !!variationForm;
      
      if (this.hasVariations) {
        this.initializeVariationHandling();
      }
    },

    initializeVariationHandling() {
      // Listen for WooCommerce variation changes
      document.addEventListener('found_variation', (event) => {
        this.currentVariation = event.detail.variation;
        this.updateCustomFields();
      });

      document.addEventListener('reset_data', () => {
        this.currentVariation = null;
        this.updateCustomFields();
      });
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
      const coverageElement = document.querySelector('[data-coverage-field]');
      if (coverageElement && this.currentVariation.coverage_m2) {
        coverageElement.textContent = this.currentVariation.coverage_m2 + ' M²';
      }
    },

    updatePanelWeightField() {
      const panelWeightElement = document.querySelector('[data-panel-weight-field]');
      if (panelWeightElement && this.currentVariation.panel_weight_kg) {
        panelWeightElement.textContent = this.currentVariation.panel_weight_kg + ' kg';
      }
    },

    updateDownloadLinks() {
      // Update download links for variation-specific files
      const dataSheetLink = document.querySelector('[data-download-data-sheet]');
      const installationGuideLink = document.querySelector('[data-download-installation-guide]');
      
      if (dataSheetLink && this.currentVariation.data_sheet_url) {
        dataSheetLink.href = this.currentVariation.data_sheet_url;
      }
      
      if (installationGuideLink && this.currentVariation.installation_guide_url) {
        installationGuideLink.href = this.currentVariation.installation_guide_url;
      }
    },

    initializeWooCommerceIntegration() {
      // Add any custom WooCommerce event handlers here
      this.handleAddToCart();
    },

    handleAddToCart() {
      document.addEventListener('added_to_cart', (event) => {
        // Custom handling after item is added to cart
        console.log('Product added to cart:', event.detail);
      });
    }
  }));

  // Coverage Calculator Component  
  Alpine.data("coverageCalculator", () => ({
    length: 0,
    width: 0,
    totalArea: 0,
    requiredQuantity: 0,
    productCoverage: 0, // Coverage per unit from product data

    init() {
      this.getProductCoverage();
    },

    getProductCoverage() {
      // Get coverage from product data or custom field
      const coverageElement = document.querySelector('[data-product-coverage]');
      if (coverageElement) {
        this.productCoverage = parseFloat(coverageElement.dataset.productCoverage) || 1;
      } else {
        // Default coverage if not specified
        this.productCoverage = 1;
      }
    },

    calculateCoverage() {
      const length = parseFloat(this.length) || 0;
      const width = parseFloat(this.width) || 0;
      
      this.totalArea = Math.round((length * width) * 100) / 100; // Round to 2 decimal places
      
      if (this.totalArea > 0 && this.productCoverage > 0) {
        this.requiredQuantity = Math.ceil(this.totalArea / this.productCoverage);
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
          const event = new Event('change', { bubbles: true });
          quantityInput.dispatchEvent(event);
        }

        // Scroll to add to cart section
        const addToCartSection = document.querySelector('.add-to-cart-section');
        if (addToCartSection) {
          addToCartSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Briefly highlight the add to cart button
          const addToCartButton = addToCartSection.querySelector('button[type="submit"]');
          if (addToCartButton) {
            addToCartButton.classList.add('ring-4', 'ring-yellow-300');
            setTimeout(() => {
              addToCartButton.classList.remove('ring-4', 'ring-yellow-300');
            }, 2000);
          }
        }
      }
    }
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
      const thumbnailContainer = this.$el.querySelector('.thumbnail-swiper');
      if (thumbnailContainer) {
        this.thumbnailSwiper = new window.Swiper(thumbnailContainer, {
          slidesPerView: 'auto',
          spaceBetween: 8,
          freeMode: true,
          watchSlidesProgress: true,
          breakpoints: {
            640: {
              slidesPerView: 4,
              spaceBetween: 12
            },
            768: {
              slidesPerView: 5,
              spaceBetween: 12
            },
            1024: {
              slidesPerView: 6,
              spaceBetween: 16
            }
          }
        });
      }

      // Initialize main image swiper
      const mainContainer = this.$el.querySelector('.main-image-swiper');
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
            }
          }
        });
      }

      // Initialize lightbox swiper
      const lightboxContainer = this.$el.querySelector('.lightbox-swiper');
      if (lightboxContainer) {
        this.lightboxSwiper = new window.Swiper(lightboxContainer, {
          slidesPerView: 1,
          spaceBetween: 0,
          navigation: {
            nextEl: '.lightbox-swiper .swiper-button-next',
            prevEl: '.lightbox-swiper .swiper-button-prev',
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
            }
          }
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
      document.body.style.overflow = 'hidden';
    },

    closeLightbox() {
      this.lightboxOpen = false;
      
      // Restore body scroll
      document.body.style.overflow = '';
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
    }
  }));
});