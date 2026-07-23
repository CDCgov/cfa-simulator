import { defineConfig } from "vitepress";
import { resolve } from "node:path";
import svgLoader from "vite-svg-loader";
import { iconSvgoConfig } from "../../cfasim-ui/components/svgLoaderConfig.mjs";
import {
  components,
  componentDocs,
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

// Sidebar entries for one package's components, from the same source of
// truth that drives generation (scripts/generate_docs.mjs).
function componentSidebarItems(outDir: "components" | "charts") {
  return componentDocs
    .filter((c: { outDir: string }) => c.outDir === outDir)
    .map((c: { name: string; slug: string }) => ({
      text: c.name,
      link: `/cfasim-ui/${outDir}/${c.slug}`,
    }));
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
        // Subpath exports must be resolved before the bare-name alias,
        // otherwise it rewrites them to `src/index.ts/<subpath>`.
        {
          find: "@cfasim-ui/charts/hsa-mapping",
          replacement: resolve(ROOT, "cfasim-ui/charts/src/hsa-mapping.ts"),
        },
        {
          find: "@cfasim-ui/charts/us-cities",
          replacement: resolve(ROOT, "cfasim-ui/charts/src/us-cities.ts"),
        },
        {
          find: "@cfasim-ui/charts/us-hsa-topology",
          replacement: resolve(ROOT, "cfasim-ui/charts/src/us-hsa-topology.ts"),
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
    plugins: [
      // Resolve @cfasim-ui/components' `*.svg?component` icon imports from src.
      svgLoader({ svgoConfig: iconSvgoConfig }),
      watchComponentSources(),
    ],
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
            items: componentSidebarItems("components"),
          },
          {
            text: "Charts",
            collapsed: false,
            items: componentSidebarItems("charts"),
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
