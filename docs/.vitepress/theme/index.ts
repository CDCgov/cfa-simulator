import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "@cfasim-ui/components/style.css";
import "@cfasim-ui/charts/style.css";
import "./demo-theme.css";
import {
  Box,
  Button,
  ButtonGroup,
  Container,
  Expander,
  Grid,
  Hint,
  Icon,
  LightDarkToggle,
  MultiSelect,
  NumberInput,
  ParamEditor,
  SelectBox,
  SidebarLayout,
  Spinner,
  TextInput,
  Toggle,
  ToggleGroup,
} from "@cfasim-ui/components";
import {
  BarChart,
  ChoroplethMap,
  DataTable,
  LineChart,
} from "@cfasim-ui/charts";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
import ComponentDemo from "./ComponentDemo.vue";
import InstallBox from "./InstallBox.vue";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "home-features-after": () => h(InstallBox),
    });
  },
  enhanceApp({ app }) {
    app.component("Box", Box);
    app.component("Button", Button);
    app.component("ButtonGroup", ButtonGroup);
    app.component("Container", Container);
    app.component("Expander", Expander);
    app.component("Grid", Grid);
    app.component("Hint", Hint);
    app.component("Icon", Icon);
    app.component("LightDarkToggle", LightDarkToggle);
    app.component("MultiSelect", MultiSelect);
    app.component("NumberInput", NumberInput);
    app.component("ParamEditor", ParamEditor);
    app.component("SelectBox", SelectBox);
    app.component("SidebarLayout", SidebarLayout);
    app.component("Spinner", Spinner);
    app.component("TextInput", TextInput);
    app.component("Toggle", Toggle);
    app.component("ToggleGroup", ToggleGroup);
    app.component("BarChart", BarChart);
    app.component("ChoroplethMap", ChoroplethMap);
    app.component("DataTable", DataTable);
    app.component("LineChart", LineChart);
    app.component("ComponentDemo", ComponentDemo);
    app.config.globalProperties.statesTopo = usStates;
    app.config.globalProperties.countiesTopo = usCounties;
  },
} satisfies Theme;
