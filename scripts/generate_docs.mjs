/**
 * Generates cfasim-ui component documentation into docs/cfasim-ui/ (the
 * VitePress site) and into cfasim-ui/{components,charts}/docs/ (the bundled
 * docs shipped inside each npm package: docs/index.json + a self-contained
 * .md per component with the API table inlined).
 *
 * 1. Copies hand-written .md files from next to each component source
 * 2. Extracts props/models/emits from Vue SFCs and generates API tables
 *
 * Handles these patterns:
 *   defineProps<{ ... }>()
 *   withDefaults(defineProps<{ ... }>(), { ... })
 *   defineProps<InterfaceName>()  (resolves interface in same script block,
 *     including `extends` chains and types imported from sibling files)
 *   defineModel<Type>()
 *   defineEmits<{ event: [...] }>()
 *
 * Can be used as a CLI (full rebuild) or imported for incremental regen
 * during `vitepress dev` (see docs/.vitepress/config.ts).
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS_ROOT = resolve(ROOT, "docs/cfasim-ui");
const INCLUDE_RE = /<!--\s*@include:\s*\.\/_api\/[^>]*-->/;

// Packages that ship bundled docs (docs/index.json + built .md per component).
const DOCS_PACKAGES = ["components", "charts"];

// PascalCase component names per package. Everything else — the docs slug
// (kebab-case) and the .vue/.md source paths — is derived below, so adding
// a component to the docs is one entry here (plus a sidebar-free .md next
// to the source; the sidebar in docs/.vitepress/config.ts derives from
// `componentDocs` too).
const COMPONENT_NAMES = [
  "Box",
  "Button",
  "ButtonGroup",
  "Container",
  "Expander",
  "Grid",
  "Hint",
  "Icon",
  "MultiSelect",
  "NumberInput",
  "ParamEditor",
  "SelectBox",
  "SidebarLayout",
  "Spinner",
  "TextInput",
  "Toggle",
  "ToggleGroup",
];
const CHART_NAMES = ["BarChart", "ChoroplethMap", "DataTable", "LineChart"];

function docEntry(name, outDir) {
  const slug = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return { name, slug, outDir };
}

/** `{ name, slug, outDir }` for every documented component. */
export const componentDocs = [
  ...COMPONENT_NAMES.map((n) => docEntry(n, "components")),
  ...CHART_NAMES.map((n) => docEntry(n, "charts")),
];

// [slug, output dir, vue source path, doc source path]
export const components = componentDocs.map(({ name, slug, outDir }) => [
  slug,
  outDir,
  `cfasim-ui/${outDir}/src/${name}/${name}.vue`,
  `cfasim-ui/${outDir}/src/${name}/${name}.md`,
]);

// --- Prop extraction helpers ---

function extractScriptBlock(source) {
  const match = source.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
  return match?.[1] ?? "";
}

function findMatchingBrace(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parsePropsFromTypeBody(body) {
  // Strip JSDoc comments so their colons don't confuse the prop regex
  body = body.replace(/\/\*\*[\s\S]*?\*\//g, "");
  const props = [];
  const propRe = /(\w+)(\?)?:\s*([^;]+);/g;
  let m;
  while ((m = propRe.exec(body)) !== null) {
    props.push({ name: m[1], type: m[3].trim(), required: !m[2] });
  }
  return props;
}

/** Resolve a `.js`-suffixed (TS-style) module path to its on-disk source. */
function resolveModulePath(modulePath, fromDir) {
  let target = modulePath;
  if (target.endsWith(".js")) target = target.slice(0, -3) + ".ts";
  const abs = resolve(fromDir, target);
  if (existsSync(abs)) return abs;
  if (existsSync(abs + ".ts")) return abs + ".ts";
  const asIndex = resolve(abs, "index.ts");
  if (existsSync(asIndex)) return asIndex;
  return null;
}

/**
 * Walks a module looking for `interface ${name}` directly, or follows
 * `export ... from "..."` re-exports (typical of barrel `index.ts`
 * files) until it finds the interface. Returns `{ file, source }` or
 * `null`.
 */
function locateInterfaceInModule(file, name, visited) {
  if (visited.has(file)) return null;
  visited.add(file);
  const source = readFileSync(file, "utf8");
  const re = new RegExp(
    `interface\\s+${name}(?:\\s+extends\\s+[\\w,\\s]+)?\\s*\\{`,
  );
  if (re.test(source)) return { file, source };
  const reExportRe =
    /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = reExportRe.exec(source)) !== null) {
    const names = m[1]
      .split(",")
      .map((s) =>
        s
          .trim()
          .replace(/^type\s+/, "")
          .replace(/\s+as\s+\w+$/, ""),
      )
      .filter(Boolean);
    if (!names.includes(name)) continue;
    const target = resolveModulePath(m[2], dirname(file));
    if (!target) continue;
    const found = locateInterfaceInModule(target, name, visited);
    if (found) return found;
  }
  const starRe = /export\s+\*\s+from\s+["']([^"']+)["']/g;
  while ((m = starRe.exec(source)) !== null) {
    const target = resolveModulePath(m[1], dirname(file));
    if (!target) continue;
    const found = locateInterfaceInModule(target, name, visited);
    if (found) return found;
  }
  return null;
}

/**
 * Find the file that declares `interface ${name}` by walking
 * `import { ... } from "..."` statements (and re-exports inside them).
 */
function findImportedInterface(script, scriptDir, name) {
  const importRe =
    /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = importRe.exec(script)) !== null) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim().replace(/^type\s+/, ""))
      .filter(Boolean);
    if (!names.includes(name)) continue;
    const resolved = resolveModulePath(m[2], scriptDir);
    if (!resolved) continue;
    const found = locateInterfaceInModule(resolved, name, new Set());
    if (found) return found;
  }
  return null;
}

function resolveInterface(script, name, scriptDir) {
  const re = new RegExp(
    `interface\\s+${name}(?:\\s+extends\\s+([\\w,\\s]+))?\\s*\\{`,
  );
  const match = re.exec(script);
  if (!match) {
    if (!scriptDir) return null;
    const found = findImportedInterface(script, scriptDir, name);
    if (!found) return null;
    return resolveInterface(found.source, name, dirname(found.file));
  }
  const parents = match[1]
    ? match[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const braceStart = match.index + match[0].length - 1;
  const braceEnd = findMatchingBrace(script, braceStart);
  if (braceEnd === -1) return null;
  const ownProps = parsePropsFromTypeBody(
    script.slice(braceStart + 1, braceEnd),
  );
  if (parents.length === 0) return ownProps;
  // Parent props come first so child entries override on duplicate names.
  const merged = [];
  const seen = new Set();
  for (const parent of parents) {
    const parentProps = resolveInterface(script, parent, scriptDir) ?? [];
    for (const p of parentProps) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      merged.push(p);
    }
  }
  for (const p of ownProps) {
    if (seen.has(p.name)) {
      // Replace earlier (parent) entry with the override.
      const idx = merged.findIndex((m) => m.name === p.name);
      if (idx >= 0) merged[idx] = p;
    } else {
      seen.add(p.name);
      merged.push(p);
    }
  }
  return merged;
}

function extractDefineProps(script, scriptDir) {
  const inlineRe = /defineProps<\{/;
  const match = inlineRe.exec(script);
  if (match) {
    const braceStart = match.index + match[0].length - 1;
    const braceEnd = findMatchingBrace(script, braceStart);
    if (braceEnd !== -1) {
      return parsePropsFromTypeBody(script.slice(braceStart + 1, braceEnd));
    }
  }
  const namedRe = /defineProps<(\w+)>\s*\(\)/;
  const namedMatch = namedRe.exec(script);
  if (namedMatch) {
    return resolveInterface(script, namedMatch[1], scriptDir) ?? [];
  }
  return [];
}

function extractDefaults(script) {
  const defaults = {};
  const wdRe = /withDefaults\s*\(\s*defineProps/;
  const match = wdRe.exec(script);
  if (!match) return defaults;
  const afterDefineProps = script.indexOf(">()", match.index);
  if (afterDefineProps === -1) return defaults;
  const commaIdx = script.indexOf(",", afterDefineProps);
  if (commaIdx === -1) return defaults;
  const braceIdx = script.indexOf("{", commaIdx);
  if (braceIdx === -1) return defaults;
  const braceEnd = findMatchingBrace(script, braceIdx);
  if (braceEnd === -1) return defaults;
  const body = script.slice(braceIdx + 1, braceEnd);
  const defaultRe = /(\w+):\s*([^,}\n]+)/g;
  let m;
  while ((m = defaultRe.exec(body)) !== null) {
    defaults[m[1]] = m[2].trim().replace(/,$/, "").trim();
  }
  return defaults;
}

function extractModels(script) {
  const models = [];
  // Type allows arrays/generics (e.g. `string[]`, `NumberRange`); the first arg
  // may be an optional name string and/or an options object.
  const re = /defineModel<([^>]+)>\s*\(\s*(?:"([^"]+)")?/g;
  let m;
  while ((m = re.exec(script)) !== null) {
    models.push({ name: m[2] ?? "modelValue", type: m[1] });
  }
  return models;
}

function extractEmits(script) {
  const emits = [];
  const re = /defineEmits<\{/;
  const match = re.exec(script);
  if (!match) return emits;
  const braceStart = match.index + match[0].length - 1;
  const braceEnd = findMatchingBrace(script, braceStart);
  if (braceEnd === -1) return emits;
  const body = script.slice(braceStart + 1, braceEnd);
  const emitRe = /(\w+):\s*\[([^\]]*)\]/g;
  let m;
  while ((m = emitRe.exec(body)) !== null) {
    emits.push({ name: m[1], payload: m[2].trim() });
  }
  return emits;
}

function analyzeComponent(filePath) {
  const source = readFileSync(filePath, "utf-8");
  const script = extractScriptBlock(source);
  const props = extractDefineProps(script, dirname(filePath));
  const defaults = extractDefaults(script);
  const models = extractModels(script);
  const emits = extractEmits(script);
  for (const prop of props) {
    if (prop.name in defaults) prop.default = defaults[prop.name];
  }
  return { props, models, emits };
}

function escapeType(type) {
  return type.replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateMarkdown(meta) {
  const sections = [];
  if (meta.models.length > 0) {
    sections.push("## Model\n");
    sections.push("| Name | Type |");
    sections.push("|------|------|");
    for (const m of meta.models) {
      const name =
        m.name === "modelValue" ? "`v-model`" : `\`v-model:${m.name}\``;
      sections.push(`| ${name} | \`${escapeType(m.type)}\` |`);
    }
    sections.push("");
  }
  if (meta.props.length > 0) {
    sections.push("## Props\n");
    sections.push("| Prop | Type | Required | Default |");
    sections.push("|------|------|----------|---------|");
    for (const p of meta.props) {
      const def = p.default ? `\`${p.default}\`` : "—";
      const req = p.required ? "Yes" : "No";
      sections.push(
        `| \`${p.name}\` | \`${escapeType(p.type)}\` | ${req} | ${def} |`,
      );
    }
    sections.push("");
  }
  if (meta.emits.length > 0) {
    sections.push("## Events\n");
    sections.push("| Event | Payload |");
    sections.push("|-------|---------|");
    for (const e of meta.emits) {
      sections.push(`| \`${e.name}\` | \`${escapeType(e.payload)}\` |`);
    }
    sections.push("");
  }
  return sections.join("\n");
}

// --- Per-component generation ---

/**
 * Regenerate the docs files for a single component. Used by the CLI loop
 * and by the dev-mode Vite plugin when a source .md or .vue changes.
 *
 * @param entry  One row from `components`
 * @param opts.updatePackage  When true, also rewrites the bundled docs
 *                            inside the component's own package (full CLI
 *                            run). Skipped in dev.
 * @returns      Per-component metadata for the package docs/index.json
 */
export function regenerateComponent(entry, { updatePackage } = {}) {
  const [slug, outDir, vuePath, docPath] = entry;
  const dir = resolve(DOCS_ROOT, outDir);
  const apiDir = resolve(dir, "_api");
  mkdirSync(apiDir, { recursive: true });

  const docSource = readFileSync(resolve(ROOT, docPath), "utf-8");
  const meta = analyzeComponent(resolve(ROOT, vuePath));
  const apiMd = generateMarkdown(meta);

  // VitePress: copy src .md as-is + write API table to _api/
  writeFileSync(resolve(dir, `${slug}.md`), docSource);
  writeFileSync(resolve(apiDir, `${slug}.md`), apiMd);

  const name = basename(vuePath, ".vue");
  const parsed = matter(docSource);
  const keywords = Array.isArray(parsed.data.keywords)
    ? parsed.data.keywords
    : [];

  if (updatePackage) {
    // Bundled package docs: a self-contained .md (API table inlined) in the
    // package's docs/ dir, shipped in the npm tarball next to src/.
    const pkgDocsDir = resolve(ROOT, `cfasim-ui/${outDir}/docs`);
    mkdirSync(pkgDocsDir, { recursive: true });
    const builtMd = parsed.content.replace(INCLUDE_RE, apiMd).trimStart();
    writeFileSync(resolve(pkgDocsDir, `${name}.md`), builtMd);
  }

  return { name, slug, outDir, keywords, meta };
}

/**
 * Find the components entry whose vue or md source matches the given path.
 * Accepts absolute or repo-relative paths.
 */
export function findComponentForSource(filePath) {
  const rel = filePath.startsWith(ROOT)
    ? filePath.slice(ROOT.length + 1)
    : filePath;
  return components.find(([, , vuePath, docPath]) => {
    return rel === vuePath || rel === docPath;
  });
}

/**
 * Delete any `.md` files in the generated outDirs (and their `_api/`
 * subdirs) that don't correspond to a current `components` entry. Without
 * this, removing/renaming a component leaves a stale page that VitePress
 * still tries to build, and SSR can fail in confusing ways.
 */
function pruneOrphanedDocs() {
  const expectedByOutDir = new Map();
  for (const [slug, outDir] of components) {
    if (!expectedByOutDir.has(outDir)) expectedByOutDir.set(outDir, new Set());
    expectedByOutDir.get(outDir).add(`${slug}.md`);
  }
  for (const [outDir, expected] of expectedByOutDir) {
    for (const dir of [
      resolve(DOCS_ROOT, outDir),
      resolve(DOCS_ROOT, outDir, "_api"),
    ]) {
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        if (!name.endsWith(".md") || expected.has(name)) continue;
        rmSync(resolve(dir, name));
        console.log(`  pruned orphan ${outDir}/${name}`);
      }
    }
  }
}

/**
 * Full rebuild: regenerate every component's docs and write each package's
 * bundled docs/ dir (built .md per component + docs/index.json).
 */
export function generateAll() {
  pruneOrphanedDocs();

  for (const pkg of DOCS_PACKAGES) {
    const docsDir = resolve(ROOT, `cfasim-ui/${pkg}/docs`);
    mkdirSync(docsDir, { recursive: true });
    const version = JSON.parse(
      readFileSync(resolve(ROOT, `cfasim-ui/${pkg}/package.json`), "utf-8"),
    ).version;

    const entries = [];
    for (const entry of components.filter(([, outDir]) => outDir === pkg)) {
      const result = regenerateComponent(entry, { updatePackage: true });
      entries.push({
        name: result.name,
        slug: result.slug,
        docs: `docs/${result.name}.md`,
        source: `src/${result.name}/${result.name}.vue`,
        keywords: result.keywords,
      });
      console.log(
        `  ${pkg}/${result.slug}.md (${result.meta.props.length} props, ${result.meta.models.length} models, ${result.meta.emits.length} emits, ${result.keywords.length} keywords)`,
      );
    }

    writeFileSync(
      resolve(docsDir, "index.json"),
      JSON.stringify(
        { version, package: `@cfasim-ui/${pkg}`, content: { [pkg]: entries } },
        null,
        2,
      ) + "\n",
    );

    // Prune stale files in place rather than clearing docs/ up front:
    // prepack runs this in both packages during publish, and an emptied
    // dir could get tarred if packs ever overlap.
    const expected = new Set([
      "index.json",
      ...entries.map((e) => `${e.name}.md`),
    ]);
    for (const name of readdirSync(docsDir)) {
      if (expected.has(name)) continue;
      rmSync(resolve(docsDir, name), { recursive: true, force: true });
      console.log(`  pruned orphan cfasim-ui/${pkg}/docs/${name}`);
    }
  }

  console.log(
    `\nGenerated docs for ${components.length} components into docs/cfasim-ui/ and cfasim-ui/{components,charts}/docs/`,
  );
}

// --- CLI entry ---

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAll();
}
