import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;
const root = resolve(import.meta.dirname, "..");

// JS limits are measured the way a consumer pays for them: a tiny Vite app
// that imports the named exports from the built package is bundled in
// memory (nothing is written), and the gzipped size of the JS the page loads
// up front (the entry chunk plus everything it imports statically) is
// compared against `limit`. `vue` is external, everything else the import
// pulls in (reka-ui, d3, CodeMirror, ...) counts. `lazyChunks` pins how
// many dynamic-import chunks the build may emit, so a component that is
// meant to stay out of the eager bundle (ParamEditor's editor, Hint's
// tooltip, the HSA mapping) is caught the moment it leaks in; `lazyLimit`
// bounds the rest of the chunks together, including any chunk the bundler
// splits out for modules two lazy chunks share.
const SCENARIOS = [
  {
    name: "components: Button only",
    pkg: "@cfasim-ui/components",
    imports: ["Button"],
    limit: 2 * KB,
    lazyChunks: 0,
  },
  {
    // A labeled field: the (?) trigger is eager, the tooltip behind it
    // (reka Tooltip + floating-ui) is a lazy chunk.
    name: "components: TextInput only",
    pkg: "@cfasim-ui/components",
    imports: ["TextInput"],
    limit: 3 * KB,
    lazyChunks: 1,
    lazyLimit: 20 * KB,
  },
  {
    name: "components: ParamEditor (eager part)",
    pkg: "@cfasim-ui/components",
    imports: ["ParamEditor"],
    limit: 12 * KB,
    // The editor itself (CodeMirror + YAML/TOML) loads on first mount; its
    // format SelectBox carries the Hint tooltip chunk with it.
    lazyChunks: 2,
    lazyLimit: 200 * KB,
  },
  {
    // List renders row/header menus through Menu, whose dropdown (reka
    // DropdownMenu + popper) is a lazy chunk loaded when a Menu mounts.
    name: "components: List only",
    pkg: "@cfasim-ui/components",
    imports: ["List"],
    limit: 13 * KB,
    lazyChunks: 1,
    lazyLimit: 22 * KB,
  },
  {
    name: "components: Menu only",
    pkg: "@cfasim-ui/components",
    imports: ["Menu"],
    limit: 7 * KB,
    lazyChunks: 1,
    lazyLimit: 25 * KB,
  },
  {
    name: "components: everything",
    pkg: "@cfasim-ui/components",
    imports: "*",
    limit: 90 * KB,
    lazyChunks: 4,
  },
  {
    name: "charts: DataTable only",
    pkg: "@cfasim-ui/charts",
    imports: ["DataTable"],
    limit: 6 * KB,
    lazyChunks: 0,
  },
  {
    name: "charts: LineChart only",
    pkg: "@cfasim-ui/charts",
    imports: ["LineChart"],
    limit: 33 * KB,
    lazyChunks: 0,
  },
  {
    name: "charts: BarChart only",
    pkg: "@cfasim-ui/charts",
    imports: ["BarChart"],
    limit: 29 * KB,
    lazyChunks: 0,
  },
  {
    name: "charts: Heatmap only",
    pkg: "@cfasim-ui/charts",
    imports: ["Heatmap"],
    limit: 20 * KB,
    lazyChunks: 0,
  },
  {
    name: "charts: ChoroplethMap only",
    pkg: "@cfasim-ui/charts",
    imports: ["ChoroplethMap"],
    limit: 57 * KB,
    lazyChunks: 0,
  },
  {
    // The translator renders all three cartesian charts, so it carries them.
    name: "charts: VegaLiteChart",
    pkg: "@cfasim-ui/charts/vega-lite",
    imports: ["VegaLiteChart"],
    limit: 57 * KB,
    lazyChunks: 0,
  },
  {
    name: "charts: everything",
    pkg: "@cfasim-ui/charts",
    imports: "*",
    limit: 120 * KB,
    lazyChunks: 0,
  },
];

// Raw size limits for stylesheets.
const CSS_LIMITS = [
  {
    name: "@cfasim-ui/components CSS",
    path: "cfasim-ui/components/dist/index.css",
    limit: 45 * KB,
  },
  {
    name: "@cfasim-ui/charts CSS",
    path: "cfasim-ui/charts/dist/index.css",
    limit: 15 * KB,
  },
  {
    name: "@cfasim-ui/theme (all CSS)",
    path: "cfasim-ui/theme/src",
    dir: true,
    limit: 20 * KB,
  },
];

// The docs site depends on both packages and on vue, so consumer builds
// resolve bare imports from there. The dist is plain JS, so no Vue plugin
// is needed.
const consumerRoot = resolve(root, "docs");
const { build } = await import("vite");

const ENTRY_ID = "\0bundle-check-entry";

function entrySource({ pkg, imports }) {
  if (imports === "*") return `import * as m from "${pkg}"; console.log(m);`;
  return `import { ${imports.join(", ")} } from "${pkg}"; console.log(${imports.join(", ")});`;
}

async function buildScenario(scenario) {
  const source = entrySource(scenario);
  const result = await build({
    root: consumerRoot,
    configFile: false,
    logLevel: "error",
    plugins: [
      {
        name: "bundle-check-entry",
        resolveId: (id) => (id === ENTRY_ID ? id : null),
        load: (id) => (id === ENTRY_ID ? source : null),
      },
    ],
    build: {
      write: false,
      rollupOptions: { input: ENTRY_ID, external: ["vue"] },
    },
  });
  const chunks = [result].flat()[0].output.filter((o) => o.type === "chunk");
  const gz = (list) =>
    gzipSync(Buffer.concat(list.map((c) => Buffer.from(c.code)))).length;
  // Eager = the entry chunk and every chunk it reaches through static
  // imports. A chunk split out for modules that two lazy chunks share is
  // not a dynamic entry, but it only loads with one of them.
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const eagerNames = new Set();
  const queue = chunks.filter((c) => c.isEntry).map((c) => c.fileName);
  for (const name of queue) {
    if (eagerNames.has(name)) continue;
    eagerNames.add(name);
    queue.push(...(byName.get(name)?.imports ?? []));
  }
  const eager = chunks.filter((c) => eagerNames.has(c.fileName));
  const lazy = chunks.filter((c) => !eagerNames.has(c.fileName));
  return {
    eager: gz(eager),
    lazy: lazy.length ? gz(lazy) : 0,
    lazy_n: chunks.filter((c) => c.isDynamicEntry).length,
  };
}

function getDirCssSize(dirPath) {
  let total = 0;
  for (const entry of readdirSync(dirPath, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isFile() && entry.name.endsWith(".css")) {
      total += statSync(resolve(entry.parentPath, entry.name)).size;
    }
  }
  return total;
}

function formatSize(bytes) {
  if (bytes < KB) return `${bytes} B`;
  return `${(bytes / KB).toFixed(1)} KB`;
}

let failed = false;
function report(ok, message) {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failed = true;
}

console.log("\nBundle size check\n");

for (const scenario of SCENARIOS) {
  const { eager, lazy, lazy_n } = await buildScenario(scenario);
  report(
    eager <= scenario.limit,
    `${scenario.name}: ${formatSize(eager)} gzip (limit: ${formatSize(scenario.limit)})`,
  );
  report(
    lazy_n === scenario.lazyChunks,
    `${scenario.name}: ${lazy_n} lazy chunk(s) (expected: ${scenario.lazyChunks})`,
  );
  if (scenario.lazyLimit !== undefined) {
    report(
      lazy <= scenario.lazyLimit,
      `${scenario.name}: lazy ${formatSize(lazy)} gzip (limit: ${formatSize(scenario.lazyLimit)})`,
    );
  }
}

for (const entry of CSS_LIMITS) {
  const fullPath = resolve(root, entry.path);
  const size = entry.dir ? getDirCssSize(fullPath) : statSync(fullPath).size;
  report(
    size <= entry.limit,
    `${entry.name}: ${formatSize(size)} raw (limit: ${formatSize(entry.limit)})`,
  );
}

// A var() that nothing defines makes its whole declaration invalid at computed
// time, and it only shows up in consumer apps: docs and the e2e tests compile
// from source, not dist. Two kinds of reference are flagged:
// - `--lightningcss-*`, which the lib build emits when it rewrites light-dark().
//   Nothing defines them and their fallbacks do not help. LIB_CSS_TARGET in
//   cfasim-ui/libOutput.mjs keeps light-dark() native; check it if these appear.
// - any other var() without a fallback that no stylesheet declares and no
//   component sets at runtime (a typo, or a removed token). A var() with a
//   fallback is left alone, since that is how optional theming hooks work.
function listFiles(dir, matches) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, matches));
    else if (matches(entry.name)) files.push(path);
  }
  return files;
}

function findUndefinedCssVars(css, declared, setAtRuntime) {
  const undefinedVars = new Set();
  for (const [, name, comma] of css.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
    if (name.startsWith("--lightningcss-")) undefinedVars.add(name);
    else if (comma || name.startsWith("--reka-")) continue;
    else if (!declared.has(name) && !setAtRuntime.has(name)) {
      undefinedVars.add(name);
    }
  }
  return [...undefinedVars];
}

const BUILT_CSS_PACKAGES = ["components", "charts"];
const stylesheets = [
  ...listFiles(resolve(root, "cfasim-ui/theme/src"), (name) =>
    name.endsWith(".css"),
  ),
  ...BUILT_CSS_PACKAGES.map((pkg) =>
    resolve(root, `cfasim-ui/${pkg}/dist/index.css`),
  ),
];
const declaredCssVars = new Set();
for (const path of stylesheets) {
  const css = readFileSync(path, "utf8");
  for (const [, name] of css.matchAll(/(--[\w-]+)\s*:/g)) {
    declaredCssVars.add(name);
  }
}

// Set from outside <style>: a style key or inline declaration, or setProperty.
// Comments are stripped so a mention in one cannot hide a typo.
const RUNTIME_CSS_VAR =
  /(?:setProperty\(\s*["'`]|["'`;\s])(--[a-zA-Z][\w-]*)(?:["'`]\s*[:,)]|\s*:)/g;
const runtimeCssVars = new Set();
for (const pkg of BUILT_CSS_PACKAGES) {
  const sources = listFiles(
    resolve(root, `cfasim-ui/${pkg}/src`),
    (name) => /\.(vue|ts)$/.test(name) && !/\.(test|spec)\.ts$/.test(name),
  );
  for (const path of sources) {
    const script = readFileSync(path, "utf8")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const [, name] of script.matchAll(RUNTIME_CSS_VAR)) {
      runtimeCssVars.add(name);
    }
  }
}

for (const pkg of BUILT_CSS_PACKAGES) {
  const css = readFileSync(
    resolve(root, `cfasim-ui/${pkg}/dist/index.css`),
    "utf8",
  );
  const undefinedVars = findUndefinedCssVars(
    css,
    declaredCssVars,
    runtimeCssVars,
  );
  report(
    undefinedVars.length === 0,
    `@cfasim-ui/${pkg} CSS: ${
      undefinedVars.length === 0
        ? "no undefined custom properties"
        : `undefined custom properties: ${undefinedVars.join(", ")}`
    }`,
  );
}

console.log();

if (failed) {
  console.error("Bundle size check failed: see the failures above.");
  process.exit(1);
}

console.log("All packages within size limits.");
