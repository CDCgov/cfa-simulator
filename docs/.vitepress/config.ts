import { defineConfig } from "vitepress";

export default defineConfig({
  title: "CFA Simulator Docs",
  base: "/cfa-simulator/docs/",
  themeConfig: {
    outline: [2, 3],
    search: {
      provider: "local",
    },
    sidebar: [
      {
        text: "Guides",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Python Projects", link: "/guide/python" },
          { text: "Rust Projects", link: "/guide/rust" },
        ],
      },
      {
        text: "cfasim-ui",
        items: [
          { text: "Overview", link: "/cfasim-ui/" },
          { text: "Theme", link: "/cfasim-ui/theme" },
          { text: "Shared", link: "/cfasim-ui/shared" },
          {
            text: "Components",
            collapsed: false,
            items: [
              { text: "Box", link: "/cfasim-ui/components/box" },
              { text: "Button", link: "/cfasim-ui/components/button" },
              { text: "Expander", link: "/cfasim-ui/components/expander" },
              { text: "Hint", link: "/cfasim-ui/components/hint" },
              { text: "Icon", link: "/cfasim-ui/components/icon" },
              {
                text: "NumberInput",
                link: "/cfasim-ui/components/number-input",
              },
              { text: "SelectBox", link: "/cfasim-ui/components/select-box" },
              {
                text: "SidebarLayout",
                link: "/cfasim-ui/components/sidebar-layout",
              },
              { text: "Spinner", link: "/cfasim-ui/components/spinner" },
              { text: "TextInput", link: "/cfasim-ui/components/text-input" },
              { text: "Toggle", link: "/cfasim-ui/components/toggle" },
            ],
          },
          {
            text: "Charts",
            collapsed: false,
            items: [
              {
                text: "ChoroplethMap",
                link: "/cfasim-ui/charts/choropleth-map",
              },
              { text: "DataTable", link: "/cfasim-ui/charts/data-table" },
              { text: "LineChart", link: "/cfasim-ui/charts/line-chart" },
            ],
          },
          {
            text: "Workers",
            collapsed: false,
            items: [
              { text: "Pyodide", link: "/cfasim-ui/pyodide" },
              { text: "WASM", link: "/cfasim-ui/wasm" },
            ],
          },
        ],
      },
    ],
  },
});
