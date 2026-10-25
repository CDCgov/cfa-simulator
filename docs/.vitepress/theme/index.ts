import { h } from "vue";
import type { Component } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "@cfasim-ui/components/style.css";
import "@cfasim-ui/charts/style.css";
import "./demo-theme.css";
import * as uiComponents from "@cfasim-ui/components";
import * as chartComponents from "@cfasim-ui/charts";
// Subpath entry points with components, outside the barrels.
import * as vegaLiteComponents from "@cfasim-ui/charts/vega-lite";
import ComponentDemo from "./ComponentDemo.vue";
import InstallBox from "./InstallBox.vue";

// Every component export from the two packages, under its export name, so
// markdown demos can use them without a hand-maintained list. The barrels
// also export helper functions (registerIcons, hasIcon) — filter to
// component-shaped objects.
function componentEntries(
  mod: Record<string, unknown>,
): Array<[string, Component]> {
  return Object.entries(mod).filter(
    (entry): entry is [string, Component] =>
      typeof entry[1] === "object" &&
      entry[1] !== null &&
      ("setup" in entry[1] || "render" in entry[1]),
  );
}

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "home-features-after": () => h(InstallBox),
    });
  },
  enhanceApp({ app }) {
    for (const [name, component] of [
      ...componentEntries(uiComponents),
      ...componentEntries(chartComponents),
      ...componentEntries(vegaLiteComponents),
    ]) {
      app.component(name, component);
    }
    app.component("ComponentDemo", ComponentDemo);
  },
} satisfies Theme;
