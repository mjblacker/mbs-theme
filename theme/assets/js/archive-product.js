// Alpine.js Custom Components and Data

// =============================================================================
// CONSTANTS AND UTILITIES
// =============================================================================

const FILTER_CONSTANTS = {
  PRICE_MIN: 0,
  PRICE_MAX: 1000,
  DEFAULT_SORT: "default",
  ADMIN_BAR_THRESHOLD: 10,
  REQUEST_TIMEOUT: 120000,
};

const SELECTORS = {
  SHOP_FILTERS: '[x-data*="shopFilters"]',
  CATEGORY_FILTER: '[x-data*="categoryDropdownFilter"]',
  BRAND_FILTER: "[x-data*=\"filterComponent('brand'\"]",
  PRICE_FILTER: '[x-data*="priceRangeFilter"]',
  ADMIN_BAR: "#wpadminbar",
  PRODUCT_RESULTS: "#product-results",
};

const SORT_LABELS = {
  default: "Default",
  date_desc: "Latest",
  date_asc: "Oldest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  name_asc: "Product Name: A-Z",
  name_desc: "Product Name: Z-A",
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const FilterUtils = {
  // Get component data from DOM element
  getComponentData(selector) {
    const element = document.querySelector(selector);
    return element?._x_dataStack?.[0] || null;
  },

  // Safe AJAX request wrapper
  async makeAjaxRequest(action, data = {}) {
    try {
      if (typeof shopFiltersAjax === "undefined") {
        throw new Error("shopFiltersAjax is not defined");
      }

      const formData = new FormData();
      formData.append("action", action);
      formData.append("nonce", shopFiltersAjax.nonce);

      Object.entries(data).forEach(([key, value]) => {
        const serializedValue =
          typeof value === "object" ? JSON.stringify(value) : value;
        formData.append(key, serializedValue);
      });

      const response = await fetch(shopFiltersAjax.ajaxUrl, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(FILTER_CONSTANTS.REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`AJAX request failed for ${action}:`, error);
      throw error;
    }
  },

  // Filter out empty values from array
  filterValidItems(items) {
    return Array.isArray(items)
      ? items.filter((item) => item && item !== "")
      : [];
  },

  // Deep clone object
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // Compare filter states
  compareFilters(filters1, filters2) {
    return (
      JSON.stringify(filters1.categories.sort()) ===
        JSON.stringify(filters2.categories.sort()) &&
      JSON.stringify(filters1.brands.sort()) ===
        JSON.stringify(filters2.brands.sort()) &&
      filters1.priceRange.min === filters2.priceRange.min &&
      filters1.priceRange.max === filters2.priceRange.max
    );
  },
};

// =============================================================================
// MAIN COMPONENTS
// =============================================================================

document.addEventListener("alpine:init", () => {
  // Header Scroll Component
  Alpine.data("headerScroll", () => ({
    mobileMenuOpen: false,
    isScrolled: false,
    lastScrollY: 0,
    adminBarHeight: 0,

    init() {
      this.detectAdminBar();
      this.lastScrollY = window.scrollY;
      this.checkScroll();
    },

    detectAdminBar() {
      const adminBar = document.querySelector(SELECTORS.ADMIN_BAR);
      this.adminBarHeight = adminBar ? adminBar.offsetHeight : 0;
    },

    checkScroll() {
      const threshold =
        this.adminBarHeight > 0
          ? this.adminBarHeight + FILTER_CONSTANTS.ADMIN_BAR_THRESHOLD
          : FILTER_CONSTANTS.ADMIN_BAR_THRESHOLD;
      this.isScrolled = window.scrollY > threshold;
    },
  }));

  // Shop Filters Component
  Alpine.data("shopFilters", () => ({
    // State
    loading: false,
    sortOrder: FILTER_CONSTANTS.DEFAULT_SORT,
    currentCategoryId: null,
    currentPage: 1,

    activeFilters: {
      categories: [],
      brands: [],
      priceRange: {
        min: FILTER_CONSTANTS.PRICE_MIN,
        max: FILTER_CONSTANTS.PRICE_MAX,
      },
    },

    appliedFilters: {
      categories: [],
      brands: [],
      priceRange: {
        min: FILTER_CONSTANTS.PRICE_MIN,
        max: FILTER_CONSTANTS.PRICE_MAX,
      },
    },

    // Initialization
    init() {
      console.log("ShopFilters initialized");
      // Auto-initialize product counts on page load
      this.initializePageLoad();
    },

    // Auto-initialize functionality on page load
    async initializePageLoad() {
      try {
        // Wait for DOM to be fully loaded
        await this.waitForDOMReady();

        // Hide initial products and show loading immediately
        this.hideInitialProductsAndShowLoading();

        // Initialize product counts (like clicking Clear button)
        await this.updateCountsOnly();

        // Auto-trigger apply filters for seamless UX - load via AJAX instead of showing defaults
        setTimeout(() => {
          this.autoTriggerApplyFilters();
        }, 100); // Reduced delay for faster loading

        // console.log("Product counts initialized, loading via AJAX");
      } catch (error) {
        //console.error("Error initializing page load:", error);
      }
    },

    // Hide initial products and show loading spinner immediately
    hideInitialProductsAndShowLoading() {
      const productResults = document.querySelector("#product-results");
      if (productResults) {
        // Hide the initial server-rendered products
        productResults.style.display = "none";
      }

      // Show loading state immediately
      this.loading = true;
      //console.log("Initial products hidden, loading spinner activated");
    },

    // Auto-trigger apply filters for seamless AJAX experience
    async autoTriggerApplyFilters() {
      try {
        // console.log(
        //   "Auto-triggering apply filters for seamless AJAX experience"
        // );

        // Actually call the applyFilters method to enable full AJAX functionality
        // This will replace the pagination with AJAX buttons and set up the proper state
        await this.applyFilters();

        //console.log("AJAX pagination now enabled - page links replaced with AJAX buttons");
      } catch (error) {
        // console.error("Error auto-triggering apply filters:", error);
      }
    },

    // Wait for DOM to be ready
    waitForDOMReady() {
      return new Promise((resolve) => {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", resolve);
        } else {
          resolve();
        }
      });
    },

    initializeCategoryPage(categoryId) {
      this.activeFilters.categories = [categoryId];
      this.currentCategoryId = categoryId;
      // console.log("Category page initialized with ID:", categoryId);
    },

    // Getters
    getCurrentSortLabel() {
      return SORT_LABELS[this.sortOrder] || "Default";
    },

    hasUnappliedChanges() {
      return !FilterUtils.compareFilters(
        this.activeFilters,
        this.appliedFilters
      );
    },

    // Filter Actions
    setSortOrder(order) {
      this.sortOrder = order;
      this.currentPage = 1; // Reset to first page when sorting
      this.filterProducts();
    },

    setPage(page) {
      this.currentPage = page;
      this.filterProducts();
    },

    async applyFilters() {
      this.collectFilterSelections();
      this.appliedFilters = FilterUtils.deepClone(this.activeFilters);
      this.currentPage = 1; // Reset to first page when applying filters
      await this.filterProducts();
    },

    // Data Collection
    collectFilterSelections() {
      if (this.currentCategoryId) {
        this.activeFilters.categories = [this.currentCategoryId];
      } else {
        this.collectCategorySelections();
      }

      this.collectBrandSelections();
      this.collectPriceSelections();
    },

    collectCategorySelections() {
      const categoryData = FilterUtils.getComponentData(
        SELECTORS.CATEGORY_FILTER
      );
      if (categoryData) {
        this.activeFilters.categories = categoryData.selectedCategories || [];
      } else {
        // Fallback for old checkbox filter
        const oldCategoryData = FilterUtils.getComponentData(
          SELECTORS.BRAND_FILTER.replace("brand", "category")
        );
        this.activeFilters.categories = oldCategoryData?.selectedItems || [];
      }
    },

    collectBrandSelections() {
      const brandData = FilterUtils.getComponentData(SELECTORS.BRAND_FILTER);
      this.activeFilters.brands = brandData?.selectedItems || [];
    },

    collectPriceSelections() {
      const priceData = FilterUtils.getComponentData(SELECTORS.PRICE_FILTER);
      if (priceData) {
        this.activeFilters.priceRange = {
          min: priceData.minPrice || FILTER_CONSTANTS.PRICE_MIN,
          max: priceData.maxPrice || FILTER_CONSTANTS.PRICE_MAX,
        };
      }
    },

    // AJAX Operations
    async filterProducts() {
      this.loading = true;

      try {
        const validCategories = FilterUtils.filterValidItems(
          this.activeFilters.categories
        );

        const requestData = {
          categories: validCategories,
          brands: this.activeFilters.brands,
          price_range: this.activeFilters.priceRange,
          current_url: window.location.href,
          page: this.currentPage,
        };

        // Only send sort_order if it's not default
        if (this.sortOrder !== FILTER_CONSTANTS.DEFAULT_SORT) {
          requestData.sort_order = this.sortOrder;
        }

        const data = await FilterUtils.makeAjaxRequest(
          "filter_products",
          requestData
        );

        if (data.success) {
          this.updateProductResults(data.data);
          this.updateFilterCounts(data.data.updated_filters);
          this.updateURL();
        } else {
          throw new Error(data.data || "Filter request failed");
        }
      } catch (error) {
        console.error("Error filtering products:", error);
      } finally {
        this.loading = false;
      }
    },

    async updateCountsOnly() {
      this.collectFilterSelections();
      // console.log("Updating counts with filters:", this.activeFilters);

      try {
        const validCategories = FilterUtils.filterValidItems(
          this.activeFilters.categories
        );

        const data = await FilterUtils.makeAjaxRequest("update_filter_counts", {
          categories: validCategories,
          brands: this.activeFilters.brands,
          price_range: this.activeFilters.priceRange,
          current_url: window.location.href,
        });

        if (data.success && data.data.updated_filters) {
          this.updateFilterCounts(data.data.updated_filters);
        }
      } catch (error) {
        console.error("Error updating counts:", error);
      }
    },

    async updateCountsAfterPartialClear(clearedFilterType) {
      this.collectFilterSelections();

      const modifiedFilters = FilterUtils.deepClone(this.activeFilters);

      // Clear only the specified filter type
      switch (clearedFilterType) {
        case "categories":
          modifiedFilters.categories = this.currentCategoryId
            ? [this.currentCategoryId]
            : [];
          break;
        case "brands":
          modifiedFilters.brands = [];
          break;
        case "priceRange":
          modifiedFilters.priceRange = {
            min: FILTER_CONSTANTS.PRICE_MIN,
            max: FILTER_CONSTANTS.PRICE_MAX,
          };
          break;
      }

      try {
        const validCategories = FilterUtils.filterValidItems(
          modifiedFilters.categories
        );

        const data = await FilterUtils.makeAjaxRequest("update_filter_counts", {
          categories: validCategories,
          brands: modifiedFilters.brands,
          price_range: modifiedFilters.priceRange,
          current_url: window.location.href,
        });

        if (data.success && data.data.updated_filters) {
          this.updateFilterCounts(data.data.updated_filters);
        }
      } catch (error) {
        console.error("Error updating counts after partial clear:", error);
      }
    },

    // UI Updates
    updateProductResults(data) {
      const resultsContainer = document.querySelector(
        SELECTORS.PRODUCT_RESULTS
      );
      if (resultsContainer && data.html) {
        resultsContainer.innerHTML = data.html;
      }
    },

    updateFilterCounts(updatedFilters) {
      if (!updatedFilters) return;

      // Update category filter counts
      const categoryData = FilterUtils.getComponentData(
        SELECTORS.CATEGORY_FILTER
      );
      if (categoryData?.items) {
        this.updateItemCounts(categoryData.items, updatedFilters.categories);
      }

      // Update brand filter counts
      const brandData = FilterUtils.getComponentData(SELECTORS.BRAND_FILTER);
      if (brandData?.items) {
        this.updateItemCounts(brandData.items, updatedFilters.brands);
      }
    },

    updateItemCounts(items, updatedCounts) {
      items.forEach((item) => {
        if (updatedCounts[item.id] !== undefined) {
          item.count = updatedCounts[item.id];
        }

        // Update child items
        if (item.children?.length > 0) {
          item.children.forEach((child) => {
            if (updatedCounts[child.id] !== undefined) {
              child.count = updatedCounts[child.id];
            }
          });
        }
      });
    },

    updateURL() {
      const url = new URL(window.location);
      const params = new URLSearchParams(url.search);

      // Clear existing filter params
      [
        "filter_categories",
        "filter_brands",
        "price_min",
        "price_max",
        "sort_order",
      ].forEach((param) => params.delete(param));

      // Add new filter params
      const validCategories = FilterUtils.filterValidItems(
        this.activeFilters.categories
      );

      if (validCategories.length > 0 && !this.currentCategoryId) {
        params.set("filter_categories", validCategories.join(","));
      }

      if (this.activeFilters.brands.length > 0) {
        params.set("filter_brands", this.activeFilters.brands.join(","));
      }

      if (
        this.activeFilters.priceRange.min > FILTER_CONSTANTS.PRICE_MIN ||
        this.activeFilters.priceRange.max < FILTER_CONSTANTS.PRICE_MAX
      ) {
        params.set("price_min", this.activeFilters.priceRange.min);
        params.set("price_max", this.activeFilters.priceRange.max);
      }

      if (this.sortOrder !== FILTER_CONSTANTS.DEFAULT_SORT) {
        params.set("sort_order", this.sortOrder);
      }

      url.search = params.toString();
      window.history.pushState({}, "", url.toString());
    },
  }));

  // Category Dropdown Filter Component
  window.categoryDropdownFilter = function (items) {
    return {
      items: items,
      selectedCategories: [],
      expandedCategories: [],
      allExpanded: true,

      init() {
        if (this.allExpanded) {
          // Start with all parent categories expanded
          const parentCategories = this.items.filter(
            (item) => item.children?.length > 0
          );
          this.expandedCategories = parentCategories.map((item) => item.id);
        }
        this.updateExpandAllState();
      },

      toggleCategory(categoryId) {
        this.toggleSelection(categoryId);
        this.handleParentChildLogic(categoryId);
        this.updateCountsOnly();
      },

      toggleSelection(categoryId) {
        const index = this.selectedCategories.indexOf(categoryId);
        if (index > -1) {
          this.selectedCategories.splice(index, 1);
          this.removeChildSelections(categoryId);
        } else {
          this.selectedCategories.push(categoryId);
          this.expandIfParent(categoryId);
          this.removeParentIfChild(categoryId);
        }
      },

      removeChildSelections(parentId) {
        const category = this.findCategoryById(parentId);
        if (category?.children?.length > 0) {
          category.children.forEach((child) => {
            const childIndex = this.selectedCategories.indexOf(child.id);
            if (childIndex > -1) {
              this.selectedCategories.splice(childIndex, 1);
            }
          });
        }
      },

      expandIfParent(categoryId) {
        const category = this.findCategoryById(categoryId);
        if (category?.children?.length > 0) {
          this.toggleExpansion(categoryId);
        }
      },

      removeParentIfChild(categoryId) {
        const parentCategory = this.findParentCategory(categoryId);
        if (parentCategory) {
          const parentIndex = this.selectedCategories.indexOf(
            parentCategory.id
          );
          if (parentIndex > -1) {
            this.selectedCategories.splice(parentIndex, 1);
          }
        }
      },

      handleParentChildLogic(categoryId) {
        // Additional logic if needed
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
        const parentCategories = this.items.filter(
          (item) => item.children?.length > 0
        );

        if (this.allExpanded) {
          this.expandedCategories = [];
        } else {
          this.expandedCategories = parentCategories.map((item) => item.id);
        }
        this.allExpanded = !this.allExpanded;
      },

      updateExpandAllState() {
        const parentCategories = this.items.filter(
          (item) => item.children?.length > 0
        );
        this.allExpanded =
          parentCategories.length > 0 &&
          parentCategories.every((item) =>
            this.expandedCategories.includes(item.id)
          );
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
        const shopFilters = FilterUtils.getComponentData(
          SELECTORS.SHOP_FILTERS
        );

        this.selectedCategories = [];
        this.expandedCategories = [];
        this.allExpanded = false;

        if (shopFilters) {
          shopFilters.updateCountsAfterPartialClear("categories");
          return shopFilters.appliedFilters.categories.length > 0;
        }

        return false;
      },

      updateCountsOnly() {
        const shopFilters = FilterUtils.getComponentData(
          SELECTORS.SHOP_FILTERS
        );
        shopFilters?.updateCountsOnly();
      },
    };
  };

  // Price Range Filter Component
  Alpine.data("priceRangeFilter", () => ({
    minPrice: FILTER_CONSTANTS.PRICE_MIN,
    maxPrice: FILTER_CONSTANTS.PRICE_MAX,

    init() {
      // Initialize with default values
    },

    updateMinPrice(value) {
      const numValue = parseInt(value);
      if (this.isValidMinPrice(numValue)) {
        this.minPrice = numValue;
        //this.updateCountsOnly();
      }
    },

    updateMaxPrice(value) {
      const numValue = parseInt(value);
      if (this.isValidMaxPrice(numValue)) {
        this.maxPrice = numValue;
        //this.updateCountsOnly();
      }
    },

    isValidMinPrice(value) {
      return value >= FILTER_CONSTANTS.PRICE_MIN && value <= this.maxPrice;
    },

    isValidMaxPrice(value) {
      return value >= this.minPrice && value <= FILTER_CONSTANTS.PRICE_MAX;
    },

    clearRange() {
      const shopFilters = FilterUtils.getComponentData(SELECTORS.SHOP_FILTERS);

      this.minPrice = FILTER_CONSTANTS.PRICE_MIN;
      this.maxPrice = FILTER_CONSTANTS.PRICE_MAX;

      if (shopFilters) {
        shopFilters.updateCountsAfterPartialClear("priceRange");
        return (
          shopFilters.appliedFilters.priceRange.min >
            FILTER_CONSTANTS.PRICE_MIN ||
          shopFilters.appliedFilters.priceRange.max < FILTER_CONSTANTS.PRICE_MAX
        );
      }

      return false;
    },

    // updateCountsOnly() {
    //   const shopFilters = FilterUtils.getComponentData(SELECTORS.SHOP_FILTERS);
    //   shopFilters?.updateCountsOnly();
    // },
  }));

  // Generic Filter Component (for brands, etc.)
  window.filterComponent = function (filterType, items) {
    return {
      filterType: filterType,
      items: items,
      selectedItems: [],
      collapsedItems: [],
      allCollapsed: false,

      init() {
        this.initializeCollapsedState();
      },

      initializeCollapsedState() {
        this.items.forEach((item) => {
          if (item.children?.length > 0) {
            this.collapsedItems.push(item.id);
          }
        });
        this.updateCollapseAllState();
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
          (item) => item.children?.length > 0
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
          (item) => item.children?.length > 0
        );
        this.allCollapsed =
          itemsWithChildren.length > 0 &&
          this.collapsedItems.length === itemsWithChildren.length;
      },

      clearAll() {
        const shopFilters = FilterUtils.getComponentData(
          SELECTORS.SHOP_FILTERS
        );

        this.selectedItems = [];

        if (shopFilters) {
          shopFilters.updateCountsAfterPartialClear("brands");
          return shopFilters.appliedFilters.brands.length > 0;
        }

        return false;
      },

      updateCountsOnly() {
        const shopFilters = FilterUtils.getComponentData(
          SELECTORS.SHOP_FILTERS
        );
        shopFilters?.updateCountsOnly();
      },
    };
  };

  // Global pagination function for use in Twig templates
  window.paginateProducts = function (page) {
    const shopFilters = FilterUtils.getComponentData(SELECTORS.SHOP_FILTERS);
    if (shopFilters) {
      shopFilters.setPage(page);
    }
  };
});
