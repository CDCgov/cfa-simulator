import { readFileSync } from "node:fs";

/**
 * Build options shared by the component library builds.
 *
 * Every runtime dependency declared in the package's package.json is
 * external: consumers install those packages anyway, so bundling them
 * would only duplicate code. `preserveModules` then emits one file per
 * source module instead of a single bundle, so a consumer's bundler pulls
 * in only the components it imports and their imports (a DataTable-only
 * app never sees d3 or the map; an app without ParamEditor never sees
 * CodeMirror). Vue's `<script setup>` sub-modules and plugin virtual
 * modules carry a `?query` that is not valid in a file name, and bundled
 * devDependency assets (the default icon SVGs) resolve under node_modules
 * (the pnpm store or a hoisted layout), so `entryFileNames` normalizes
 * both.
 *
 * @param {string | URL} packageJsonUrl
 */
export function libBuildOptions(packageJsonUrl) {
  const pkg = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
  const externals = Object.keys({
    ...pkg.dependencies,
    ...pkg.peerDependencies,
  });
  return {
    /** @param {string} id */
    external: (id) =>
      externals.some((name) => id === name || id.startsWith(name + "/")),
    output: {
      preserveModules: true,
      preserveModulesRoot: "src",
      /** @param {{ name: string }} chunk */
      entryFileNames: (chunk) =>
        chunk.name
          // Bundled dependency files (the icon SVGs):
          // node_modules/.pnpm/<pkg>@<ver>/node_modules/@material-symbols/svg-400/outlined/add.svg?component
          // -> _deps/@material-symbols/svg-400/outlined/add.svg?component
          // Greedy up to the last node_modules/, so a hoisted layout
          // (node_modules/@material-symbols/...) lands in the same place.
          .replace(/^.*node_modules\//, "_deps/")
          // Vue's compiled script block, a second module next to the .vue
          // wrapper: LineChart/LineChart.vue?vue&type=script&setup=true&lang.ts
          // -> LineChart/LineChart.vue_script
          .replace(/\?vue&type=script.*$/, "_script")
          // Any query left (vite-svg-loader's ?component): add.svg?component
          // -> add.svg_component. Also the fallback if a plugin changes its
          // query format, so the name is always valid.
          .replace(/[?&=]/g, "_") + ".js",
    },
  };
}
