import "./styles/main.css";
import.meta.glob("../blocks/**/*.css", { eager: true });
import Alpine from "alpinejs";

// Import Swiper and modules globally
import { Swiper } from "swiper";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

// Make Swiper globally available
window.Swiper = Swiper;
window.SwiperNavigation = Navigation;

window.Alpine = Alpine;

import.meta.glob("../blocks/**/*.js", { eager: true });

window.Alpine.start();
