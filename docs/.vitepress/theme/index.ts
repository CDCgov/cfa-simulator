import { h } from "vue";
import type { Component } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "@cfasim-ui/components/style.css";
import "@cfasim-ui/charts/style.css";
import "./demo-theme.css";
import * as uiComponents from "@cfasim-ui/components";
import * as chartComponents from "@cfasim-ui/charts";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
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
    ]) {
      app.component(name, component);
    }
    app.component("ComponentDemo", ComponentDemo);
    app.config.globalProperties.statesTopo = usStates;
    app.config.globalProperties.countiesTopo = usCounties;
  },
} satisfies Theme;
