// Alpine.js Custom Components and Data

// Header scroll functionality
document.addEventListener("alpine:init", () => {
  Alpine.data("headerScroll", () => ({
    mobileMenuOpen: false,
    isScrolled: false,
    lastScrollY: 0,
    adminBarHeight: 0,

    init() {
      // Detect admin bar height
      const adminBar = document.getElementById("wpadminbar");
      this.adminBarHeight = adminBar ? adminBar.offsetHeight : 0;

      this.lastScrollY = window.scrollY;
      this.checkScroll();
    },

    checkScroll() {
      // Account for admin bar height in scroll detection
      const scrollThreshold =
        this.adminBarHeight > 0 ? this.adminBarHeight + 10 : 10;
      this.isScrolled = window.scrollY > scrollThreshold;
    },
  }));

  // Shop Filters functionality
  Alpine.data("shopFilters", () => ({
    loading: false,
    activeFilters: {
      categories: [],
      brands: [],
      priceRange: {
        min: 0,
        max: 1000
      }
    },
    sortOrder: 'date_desc',
    currentCategoryId: null,

    init() {
      // No automatic filtering on init
    },

    initializeCategoryPage(categoryId) {
      // When on a category page, initialize with that category pre-selected
      this.activeFilters.categories = [categoryId];
      this.currentCategoryId = categoryId;
    },

    getCurrentSortLabel() {
      const sortLabels = {
        'date_desc': 'Latest',
        'date_asc': 'Oldest',
        'price_asc': 'Price: Low to High',
        'price_desc': 'Price: High to Low',
        'name_asc': 'Product Name: A-Z',
        'name_desc': 'Product Name: Z-A'
      };
      return sortLabels[this.sortOrder] || 'Latest';
    },

    setSortOrder(order) {
      this.sortOrder = order;
      this.filterProducts();
    },

    applyFilters() {
      // Collect current selections from all filter components
      this.collectFilterSelections();

      // Trigger product filtering
      this.filterProducts();
    },

    collectFilterSelections() {
      // If on a category page, maintain the category context
      if (this.currentCategoryId) {
        this.activeFilters.categories = [this.currentCategoryId];
      } else {
        // Get categories from category dropdown filter component (only on shop page)
        const categoryDropdownComponents = document.querySelectorAll(
          "[x-data*=\"categoryDropdownFilter\"]"
        );
        if (categoryDropdownComponents.length > 0) {
          const categoryComponent = categoryDropdownComponents[0];
          if (
            categoryComponent._x_dataStack &&
            categoryComponent._x_dataStack[0]
          ) {
            this.activeFilters.categories =
              categoryComponent._x_dataStack[0].selectedCategories || [];
          }
        } else {
          // Fallback to old checkbox filter component if dropdown not found
          const categoryComponents = document.querySelectorAll(
            "[x-data*=\"filterComponent('category'\"]"
          );
          if (categoryComponents.length > 0) {
            const categoryComponent = categoryComponents[0];
            if (
              categoryComponent._x_dataStack &&
              categoryComponent._x_dataStack[0]
            ) {
              this.activeFilters.categories =
                categoryComponent._x_dataStack[0].selectedItems || [];
            }
          } else {
            // If no category components found, ensure categories is empty array
            this.activeFilters.categories = [];
          }
        }
      }

      // Get brands from brand filter component
      const brandComponents = document.querySelectorAll(
        "[x-data*=\"filterComponent('brand'\"]"
      );
      if (brandComponents.length > 0) {
        const brandComponent = brandComponents[0];
        if (brandComponent._x_dataStack && brandComponent._x_dataStack[0]) {
          this.activeFilters.brands =
            brandComponent._x_dataStack[0].selectedItems || [];
        }
      }

      // Get price range from price range component
      const priceRangeComponents = document.querySelectorAll(
        "[x-data*=\"priceRangeFilter\"]"
      );
      if (priceRangeComponents.length > 0) {
        const priceComponent = priceRangeComponents[0];
        if (priceComponent._x_dataStack && priceComponent._x_dataStack[0]) {
          this.activeFilters.priceRange = {
            min: priceComponent._x_dataStack[0].minPrice || 0,
            max: priceComponent._x_dataStack[0].maxPrice || 1000
          };
        }
      }
    },

    async filterProducts() {
      this.loading = true;

      try {
        // Check if AJAX data is available
        if (typeof shopFiltersAjax === "undefined") {
          console.error(
            "shopFiltersAjax is not defined. Make sure wp_localize_script is working."
          );
          this.loading = false;
          return;
        }

        const formData = new FormData();
        formData.append("action", "filter_products");
        formData.append("nonce", shopFiltersAjax.nonce);
        
        // Filter out empty categories before sending
        const validCategories = this.activeFilters.categories.filter(cat => cat && cat !== "");
        formData.append("categories", JSON.stringify(validCategories));
        
        formData.append("brands", JSON.stringify(this.activeFilters.brands));
        formData.append("price_range", JSON.stringify(this.activeFilters.priceRange));
        formData.append("sort_order", this.sortOrder);
        formData.append("current_url", window.location.href);

        // console.log('Sending AJAX data:', {
        //     action: 'filter_products',
        //     nonce: shopFiltersAjax.nonce,
        //     categories: this.activeFilters.categories,
        //     brands: this.activeFilters.brands,
        //     ajaxUrl: shopFiltersAjax.ajaxUrl
        // });

        const response = await fetch(shopFiltersAjax.ajaxUrl, {
          method: "POST",
          body: formData,
        });

        // console.log('Response status:', response.status);
        // console.log('Response headers:', response.headers);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server response:", errorText);
          throw new Error(
            `Network response was not ok: ${
              response.status
            } - ${errorText.substring(0, 200)}`
          );
        }

        const data = await response.json();

        if (data.success) {
          // Update product results
          document.getElementById("product-results").innerHTML = data.data.html;

          // Update URL without page refresh
          const newUrl = this.buildFilterUrl();
          window.history.pushState({}, "", newUrl);
        } else {
          console.error("Filter request failed:", data.data);
        }
      } catch (error) {
        console.error("Error filtering products:", error);
      } finally {
        this.loading = false;
      }
    },

    buildFilterUrl() {
      const url = new URL(window.location);
      const params = new URLSearchParams(url.search);

      // Clear existing filter params
      params.delete("filter_categories");
      params.delete("filter_brands");
      params.delete("price_min");
      params.delete("price_max");
      params.delete("sort_order");

      // Add new filter params (only add category filter if not on a category page and has categories)
      if (this.activeFilters.categories.length > 0 && !this.currentCategoryId) {
        // Filter out any empty values
        const validCategories = this.activeFilters.categories.filter(cat => cat && cat !== "");
        if (validCategories.length > 0) {
          params.set("filter_categories", validCategories.join(","));
        }
      }
      if (this.activeFilters.brands.length > 0) {
        params.set("filter_brands", this.activeFilters.brands.join(","));
      }
      if (this.activeFilters.priceRange.min > 0 || this.activeFilters.priceRange.max < 1000) {
        params.set("price_min", this.activeFilters.priceRange.min);
        params.set("price_max", this.activeFilters.priceRange.max);
      }
      if (this.sortOrder !== 'date_desc') {
        params.set("sort_order", this.sortOrder);
      }

      url.search = params.toString();
      return url.toString();
    },
  }));

  // Category Dropdown Filter functionality
  window.categoryDropdownFilter = function (items) {
    return {
      items: items,
      selectedCategories: [],
      expandedCategories: [],
      allExpanded: false,

      init() {
        // Initialize expanded state for parent categories that have selected children
        this.updateExpandAllState();
      },

      toggleCategory(categoryId) {
        const category = this.findCategoryById(categoryId);
        const index = this.selectedCategories.indexOf(categoryId);
        
        if (index > -1) {
          // Remove this category
          this.selectedCategories.splice(index, 1);
          
          // If removing a parent category, also remove all its children
          if (category && category.children && category.children.length > 0) {
            category.children.forEach(child => {
              const childIndex = this.selectedCategories.indexOf(child.id);
              if (childIndex > -1) {
                this.selectedCategories.splice(childIndex, 1);
              }
            });
          }
        } else {
          // Add this category
          this.selectedCategories.push(categoryId);
          
          // If this is a parent category, toggle expansion but don't auto-select children
          if (category && category.children && category.children.length > 0) {
            this.toggleExpansion(categoryId);
          } else {
            // If this is a child category, remove its parent from selection if it was selected
            const parentCategory = this.findParentCategory(categoryId);
            if (parentCategory) {
              const parentIndex = this.selectedCategories.indexOf(parentCategory.id);
              if (parentIndex > -1) {
                this.selectedCategories.splice(parentIndex, 1);
              }
            }
          }
        }
      },

      toggleExpansion(categoryId) {
        const index = this.expandedCategories.indexOf(categoryId);
        if (index > -1) {
          this.expandedCategories.splice(index, 1);
        } else {
          this.expandedCategories.push(categoryId);
        }
        this.updateExpandAllState();
      },

      toggleExpandAll() {
        const parentCategories = this.items.filter(item => 
          item.children && item.children.length > 0
        );

        if (this.allExpanded) {
          // Collapse all
          this.expandedCategories = [];
        } else {
          // Expand all
          this.expandedCategories = parentCategories.map(item => item.id);
        }
        this.allExpanded = !this.allExpanded;
      },

      updateExpandAllState() {
        const parentCategories = this.items.filter(item => 
          item.children && item.children.length > 0
        );
        this.allExpanded = parentCategories.length > 0 && 
          parentCategories.every(item => this.expandedCategories.includes(item.id));
      },

      findCategoryById(id) {
        for (const item of this.items) {
          if (item.id == id) return item;
          if (item.children) {
            for (const child of item.children) {
              if (child.id == id) return child;
            }
          }
        }
        return null;
      },

      findParentCategory(childId) {
        for (const item of this.items) {
          if (item.children) {
            for (const child of item.children) {
              if (child.id == childId) return item;
            }
          }
        }
        return null;
      },

      clearAll() {
        this.selectedCategories = [];
        this.expandedCategories = [];
        this.allExpanded = false;
      }
    };
  };

  // Price Range Filter functionality
  Alpine.data("priceRangeFilter", () => ({
    minPrice: 0,
    maxPrice: 1000,

    init() {
      // Initialize with default values
    },

    updateMinPrice(value) {
      const numValue = parseInt(value);
      if (numValue >= 0 && numValue <= this.maxPrice) {
        this.minPrice = numValue;
      }
    },

    updateMaxPrice(value) {
      const numValue = parseInt(value);
      if (numValue >= this.minPrice && numValue <= 1000) {
        this.maxPrice = numValue;
      }
    },

    clearRange() {
      this.minPrice = 0;
      this.maxPrice = 1000;
    }
  }));

  // Filter Component functionality
  window.filterComponent = function (filterType, items) {
    return {
      filterType: filterType,
      items: items,
      selectedItems: [],
      collapsedItems: [],
      allCollapsed: false,

      init() {
        // Initialize collapsed state for items with children
        this.items.forEach((item) => {
          if (item.children && item.children.length > 0) {
            this.collapsedItems.push(item.id);
          }
        });
        this.allCollapsed =
          this.collapsedItems.length ===
          this.items.filter((item) => item.children && item.children.length > 0)
            .length;
      },

      toggleItemCollapse(itemId) {
        const index = this.collapsedItems.indexOf(itemId);
        if (index > -1) {
          this.collapsedItems.splice(index, 1);
        } else {
          this.collapsedItems.push(itemId);
        }
        this.updateCollapseAllState();
      },

      toggleCollapseAll() {
        const itemsWithChildren = this.items.filter(
          (item) => item.children && item.children.length > 0
        );

        if (this.allCollapsed) {
          this.collapsedItems = [];
        } else {
          this.collapsedItems = itemsWithChildren.map((item) => item.id);
        }
        this.allCollapsed = !this.allCollapsed;
      },

      updateCollapseAllState() {
        const itemsWithChildren = this.items.filter(
          (item) => item.children && item.children.length > 0
        );
        this.allCollapsed =
          this.collapsedItems.length === itemsWithChildren.length;
      },

      clearAll() {
        this.selectedItems = [];
      },
    };
  };
});
