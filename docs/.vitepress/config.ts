import { defineConfig } from "vitepress";
import { resolve } from "node:path";
import {
  components,
  findComponentForSource,
  regenerateComponent,
} from "../../scripts/generate_docs.mjs";

const ROOT = resolve(import.meta.dirname, "../..");

// VitePress and the root vite resolve to different nested copies of vite,
// so importing `ViteDevServer` from either side conflicts with the other.
// We only need `server.watcher` (a chokidar FSWatcher), so type just that.
type WatcherOnly = {
  watcher: {
    add(paths: readonly string[]): void;
    on(event: "change", cb: (path: string) => void): void;
  };
};

/**
 * Dev-mode plugin: watch each component's source .md and .vue in
 * cfasim-ui/{components,charts}/src/**, and on change re-run the
 * per-component generator. Writing the regenerated .md back into
 * docs/cfasim-ui/ lets VitePress's own watcher trigger HMR.
 */
function watchComponentSources() {
  return {
    name: "cfasim-watch-component-sources",
    apply: "serve" as const,
    configureServer(server: WatcherOnly) {
      const watched = components.flatMap(([, , vuePath, docPath]) => [
        resolve(ROOT, vuePath),
        resolve(ROOT, docPath),
      ]);
      server.watcher.add(watched);

      server.watcher.on("change", (path) => {
        const entry = findComponentForSource(path);
        if (!entry) return;
        try {
          regenerateComponent(entry);
          console.log(`[cfasim] regenerated ${entry[1]}/${entry[0]}.md`);
        } catch (err) {
          console.error(`[cfasim] regen failed for ${path}:`, err);
        }
      });
    },
  };
}

export default defineConfig({
  title: "CFA Simulator Docs",
  base: "/cfa-simulator/docs/",
  vite: {
    resolve: {
      alias: [
        // Map the built CSS subpaths to an empty stub — in dev, scoped
        // styles inject via @vitejs/plugin-vue from the aliased src/.
        {
          find: "@cfasim-ui/components/style.css",
          replacement: resolve(import.meta.dirname, "empty.css"),
        },
        {
          find: "@cfasim-ui/charts/style.css",
          replacement: resolve(import.meta.dirname, "empty.css"),
        },
        // Resolve package imports to source so Vue SFC edits hot-reload
        // without needing `plz build` first.
        {
          find: "@cfasim-ui/components",
          replacement: resolve(ROOT, "cfasim-ui/components/src/index.ts"),
        },
        {
          find: "@cfasim-ui/charts",
          replacement: resolve(ROOT, "cfasim-ui/charts/src/index.ts"),
        },
      ],
    },
    plugins: [watchComponentSources()],
  },
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
              { text: "Container", link: "/cfasim-ui/components/container" },
              { text: "Expander", link: "/cfasim-ui/components/expander" },
              { text: "Grid", link: "/cfasim-ui/components/grid" },
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
              { text: "BarChart", link: "/cfasim-ui/charts/bar-chart" },
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
