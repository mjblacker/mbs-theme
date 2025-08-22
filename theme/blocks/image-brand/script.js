/**
 * Image Brand Block JavaScript
 * 
 * Provides enhanced functionality for the Image Brand block including:
 * - Lazy loading for brand images
 * - Enhanced hover effects
 * - Accessibility improvements
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get all Image Brand blocks on the page
    const imageBrandBlocks = document.querySelectorAll('.image-brand');
    
    imageBrandBlocks.forEach(function(block) {
        initImageBrandBlock(block);
    });
});

/**
 * Initialize Image Brand Block functionality
 * @param {Element} block - The Image Brand block element
 */
function initImageBrandBlock(block) {
    const brandItems = block.querySelectorAll('.image-brand__item');
    const brandImages = block.querySelectorAll('.image-brand__item img');
    
    // Add intersection observer for subtle animation on scroll
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        brandItems.forEach(function(item, index) {
            // Add staggered animation delay
            item.style.animationDelay = (index * 0.1) + 's';
            observer.observe(item);
        });
    }
    
    // Enhanced keyboard navigation for linked brand items
    const brandLinks = block.querySelectorAll('.image-brand__item a');
    brandLinks.forEach(function(link) {
        link.addEventListener('keydown', function(e) {
            // Add visual feedback for keyboard navigation
            if (e.key === 'Enter' || e.key === ' ') {
                link.classList.add('keyboard-activated');
                setTimeout(function() {
                    link.classList.remove('keyboard-activated');
                }, 150);
            }
        });
    });
    
    // Preload images on hover for better performance
    brandItems.forEach(function(item) {
        const img = item.querySelector('img');
        if (img && img.dataset.src) {
            item.addEventListener('mouseenter', function() {
                if (img.src !== img.dataset.src) {
                    img.src = img.dataset.src;
                }
            });
        }
    });
    
    // Add error handling for failed image loads
    brandImages.forEach(function(img) {
        img.addEventListener('error', function() {
            // Hide the item if image fails to load
            const item = img.closest('.image-brand__item');
            if (item) {
                item.style.display = 'none';
                console.warn('Image Brand: Failed to load image', img.src);
            }
        });
        
        img.addEventListener('load', function() {
            // Add loaded class for CSS transitions
            img.classList.add('loaded');
        });
    });
}