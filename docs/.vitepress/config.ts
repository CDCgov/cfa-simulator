import { defineConfig } from "vitepress";

export default defineConfig({
  title: "CFA Simulator Docs",
  base: "/docs/",
  themeConfig: {
    sidebar: [
      {
        text: "Guides",
        items: [
          { text: "Getting Started", link: "/getting-started" },
        ],
      },
      {
        text: "cfasim-ui",
        items: [
          { text: "Overview", link: "/cfasim-ui/" },
          { text: "Theme", link: "/cfasim-ui/theme" },
          {
            text: "Components",
            collapsed: false,
            items: [
              { text: "Box", link: "/cfasim-ui/components/box" },
              { text: "Button", link: "/cfasim-ui/components/button" },
              { text: "Expander", link: "/cfasim-ui/components/expander" },
              { text: "Hint", link: "/cfasim-ui/components/hint" },
              { text: "Icon", link: "/cfasim-ui/components/icon" },
              { text: "NumberInput", link: "/cfasim-ui/components/number-input" },
              { text: "SelectBox", link: "/cfasim-ui/components/select-box" },
              { text: "Spinner", link: "/cfasim-ui/components/spinner" },
              { text: "TextInput", link: "/cfasim-ui/components/text-input" },
              { text: "Toggle", link: "/cfasim-ui/components/toggle" },
            ],
          },
          {
            text: "Charts",
            collapsed: false,
            items: [{ text: "LineChart", link: "/cfasim-ui/charts/line-chart" }],
          },
        ],
      },
    ],
  },
});
