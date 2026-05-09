import { createApp } from "vue";
import "@cfasim-ui/theme/all";
import "@cfasim-ui/theme/themes/cdc.css";
import App from "./App.vue";
import { router } from "./router";

createApp(App).use(router).mount("#app");
