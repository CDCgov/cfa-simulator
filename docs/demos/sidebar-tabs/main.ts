import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import "@cfasim-ui/theme/all";
import App from "./App.vue";
import ChartPage from "./pages/ChartPage.vue";
import DataPage from "./pages/DataPage.vue";
import SettingsPage from "./pages/SettingsPage.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/chart" },
    { path: "/chart", component: ChartPage },
    { path: "/data", component: DataPage },
    { path: "/settings", component: SettingsPage },
  ],
});

createApp(App).use(router).mount("#app");
