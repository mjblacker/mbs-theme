// Alpine.js Custom Components and Data

// Header scroll functionality
document.addEventListener('alpine:init', () => {
    Alpine.data('headerScroll', () => ({
        mobileMenuOpen: false,
        isScrolled: false,
        lastScrollY: 0,
        adminBarHeight: 0,
        
        init() {
            // Detect admin bar height
            const adminBar = document.getElementById('wpadminbar');
            this.adminBarHeight = adminBar ? adminBar.offsetHeight : 0;
            
            this.lastScrollY = window.scrollY;
            this.checkScroll();
        },
        
        checkScroll() {
            // Account for admin bar height in scroll detection
            const scrollThreshold = this.adminBarHeight > 0 ? this.adminBarHeight + 10 : 10;
            this.isScrolled = window.scrollY > scrollThreshold;
        }
    }));
});