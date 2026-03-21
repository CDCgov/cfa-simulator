import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./demo-theme.css";
import {
  Box,
  Button,
  Expander,
  Hint,
  Icon,
  NumberInput,
  SelectBox,
  SidebarLayout,
  Spinner,
  TextInput,
  Toggle,
} from "@cfasim-ui/components";
import { DataTable, LineChart } from "@cfasim-ui/charts";
import ComponentDemo from "./ComponentDemo.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Box", Box);
    app.component("Button", Button);
    app.component("Expander", Expander);
    app.component("Hint", Hint);
    app.component("Icon", Icon);
    app.component("NumberInput", NumberInput);
    app.component("SelectBox", SelectBox);
    app.component("SidebarLayout", SidebarLayout);
    app.component("Spinner", Spinner);
    app.component("TextInput", TextInput);
    app.component("Toggle", Toggle);
    app.component("DataTable", DataTable);
    app.component("LineChart", LineChart);
    app.component("ComponentDemo", ComponentDemo);
  },
} satisfies Theme;
