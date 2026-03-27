import { createRouter, createWebHistory } from "vue-router";
import Home from "./Home.vue";

export const models = [
  {
    path: "/reed-frost",
    name: "Reed-Frost Epidemic",
    description: "Stochastic Reed-Frost epidemic simulation (Rust/WASM)",
    component: () => import("./reed-frost/Page.vue"),
  },
  {
    path: "/python-example",
    name: "Python Example",
    description: "Simple simulation model running via Pyodide",
    component: () => import("./python-example/Page.vue"),
  },
  {
    path: "/fetch-example",
    name: "Fetch Example",
    description: "CFA Pyrenew hospital admission forecasts",
    component: () => import("./fetch-example/Page.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    ...models.map(({ path, component }) => ({ path, component })),
  ],
});
