document.addEventListener('alpine:init', () => {
  Alpine.data('siteHeader', () => ({
    mobileMenuOpen: false,
    productSearchOpen: false,
    searchTrigger: null,

    init() {
      this.$watch('mobileMenuOpen', (open) => {
        if (open) this.closeProductSearch();
      });
    },

    toggleProductSearch(event) {
      if (this.productSearchOpen) {
        this.closeProductSearch(true);
        return;
      }

      this.searchTrigger = event.currentTarget;
      this.mobileMenuOpen = false;
      this.productSearchOpen = true;
      this.$nextTick(() => this.$refs.productSearchInput.focus());
    },

    closeProductSearch(returnFocus = false) {
      if (!this.productSearchOpen) return;

      this.productSearchOpen = false;
      if (returnFocus) this.searchTrigger?.focus();
    },
  }));
});
