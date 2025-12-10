import "./styles/main.css";
import.meta.glob("../blocks/**/*.css", { eager: true });
import Alpine from "alpinejs"
import focus from '@alpinejs/focus'
import persist from '@alpinejs/persist'

// Import Swiper and modules globally
import { Swiper } from "swiper";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

// Make Swiper globally available
window.Swiper = Swiper;
window.SwiperNavigation = Navigation;

// Import alpinejs modules for this site
import alertPersist from './js/alpinejs-alert-persist.js'

Alpine.plugin(focus)
Alpine.plugin(persist)
window.Alpine = Alpine;
window.AlertPersist = alertPersist;

import.meta.glob("../blocks/**/*.js", { eager: true });
import.meta.glob("./js/**/*.js", { eager: true });

window.Alpine.start();
