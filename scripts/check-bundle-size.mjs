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
    name: "components: everything",
    pkg: "@cfasim-ui/components",
    imports: "*",
    limit: 80 * KB,
    lazyChunks: 3,
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
    limit: 29 * KB,
    lazyChunks: 0,
  },
  {
    name: "charts: BarChart only",
    pkg: "@cfasim-ui/charts",
    imports: ["BarChart"],
    limit: 28 * KB,
    lazyChunks: 0,
  },
  {
    name: "charts: ChoroplethMap only",
    pkg: "@cfasim-ui/charts",
    imports: ["ChoroplethMap"],
    limit: 57 * KB,
    lazyChunks: 1,
    lazyLimit: 26 * KB,
  },
  {
    name: "charts: everything",
    pkg: "@cfasim-ui/charts",
    imports: "*",
    limit: 112 * KB,
    lazyChunks: 1,
  },
];

// Raw size limits for stylesheets.
const CSS_LIMITS = [
  {
    name: "@cfasim-ui/components CSS",
    path: "cfasim-ui/components/dist/index.css",
    limit: 30 * KB,
  },
  {
    name: "@cfasim-ui/charts CSS",
    path: "cfasim-ui/charts/dist/index.css",
    limit: 14 * KB,
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

console.log();

if (failed) {
  console.error("Bundle size check failed: one or more limits exceeded.");
  process.exit(1);
}

console.log("All packages within size limits.");
