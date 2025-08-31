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
    },
    sortOrder: 'date_desc',

    init() {
      // No automatic filtering on init
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
      // Get categories from category filter component
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
        formData.append(
          "categories",
          JSON.stringify(this.activeFilters.categories)
        );
        formData.append("brands", JSON.stringify(this.activeFilters.brands));
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
      params.delete("sort_order");

      // Add new filter params
      if (this.activeFilters.categories.length > 0) {
        params.set(
          "filter_categories",
          this.activeFilters.categories.join(",")
        );
      }
      if (this.activeFilters.brands.length > 0) {
        params.set("filter_brands", this.activeFilters.brands.join(","));
      }
      if (this.sortOrder !== 'date_desc') {
        params.set("sort_order", this.sortOrder);
      }

      url.search = params.toString();
      return url.toString();
    },
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
