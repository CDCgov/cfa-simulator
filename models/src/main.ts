import { createApp } from "vue";
import "@cfasim-ui/theme";
import App from "./App.vue";
import { router } from "./router";

createApp(App).use(router).mount("#app");
