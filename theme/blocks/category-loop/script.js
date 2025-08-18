// Initialize Swiper for category carousels (both frontend and editor)
// Note: Swiper is loaded globally in main.js
function initializeCategoryCarousels() {
    const categoryCarousels = document.querySelectorAll('.category-carousel');
    
    categoryCarousels.forEach(carousel => {
        // Skip if already initialized
        if (carousel.swiper) {
            carousel.swiper.destroy(true, true);
        }
        
        const slidesPerView = parseInt(carousel.dataset.slidesPerView) || 4;
        
        // Check if we have enough slides for loop to work properly
        const totalSlides = carousel.querySelectorAll('.swiper-slide').length;
        const shouldLoop = totalSlides > 2; // More conservative check

        new window.Swiper(carousel, {
            modules: [window.SwiperNavigation],
            slidesPerView: 1,
            spaceBetween: 20,
            navigation: {
                nextEl: carousel.closest('.category-loop-block').querySelector('.category-carousel-next'),
                prevEl: carousel.closest('.category-loop-block').querySelector('.category-carousel-prev'),
            },
            breakpoints: {
                640: {
                    slidesPerView: Math.min(2, slidesPerView),
                    spaceBetween: 20,
                },
                768: {
                    slidesPerView: Math.min(3, slidesPerView),
                    spaceBetween: 24,
                },
                1024: {
                    slidesPerView: slidesPerView,
                    spaceBetween: 32,
                },
            },
            loop: shouldLoop,
            loopFillGroupWithBlank: false,
            loopPreventsSlide: false,
            grabCursor: true,
            watchSlidesProgress: true,
            simulateTouch: true,
            touchRatio: 1,
            touchAngle: 45,
            shortSwipes: true,
            longSwipes: true,
            followFinger: true,
        });
    });
}

// Initialize on DOM ready (frontend)
document.addEventListener('DOMContentLoaded', initializeCategoryCarousels);

// WordPress Editor Support
if (window.wp && window.wp.blocks) {
    // Hook into block editor events
    window.wp.data.subscribe(() => {
        // Delay initialization to ensure DOM is updated
        setTimeout(initializeCategoryCarousels, 100);
    });
}

// Legacy DOM mutation support (fallback)
document.addEventListener('DOMNodeInserted', function(e) {
    if (e.target.classList && e.target.classList.contains('category-carousel')) {
        setTimeout(initializeCategoryCarousels, 100);
    }
});

// Modern MutationObserver approach
if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        if (node.classList && node.classList.contains('category-carousel')) {
                            setTimeout(initializeCategoryCarousels, 100);
                        }
                        // Also check children
                        const carousels = node.querySelectorAll && node.querySelectorAll('.category-carousel');
                        if (carousels && carousels.length > 0) {
                            setTimeout(initializeCategoryCarousels, 100);
                        }
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}