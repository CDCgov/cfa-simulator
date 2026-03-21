/**
 * Generates cfasim-ui component documentation into docs/cfasim-ui/.
 *
 * 1. Copies hand-written .md files from next to each component source
 * 2. Extracts props/models/emits from Vue SFCs and generates API tables
 *
 * Handles these patterns:
 *   defineProps<{ ... }>()
 *   withDefaults(defineProps<{ ... }>(), { ... })
 *   defineProps<InterfaceName>()  (resolves interface in same script block)
 *   defineModel<Type>()
 *   defineEmits<{ event: [...] }>()
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS_ROOT = resolve(ROOT, "docs/cfasim-ui");

// [slug, output dir, vue source path, doc source path]
const components = [
  ["box", "components", "cfasim-ui/components/src/Box.vue", "cfasim-ui/components/src/Box.md"],
  ["button", "components", "cfasim-ui/components/src/Button.vue", "cfasim-ui/components/src/Button.md"],
  ["expander", "components", "cfasim-ui/components/src/Expander.vue", "cfasim-ui/components/src/Expander.md"],
  ["hint", "components", "cfasim-ui/components/src/Hint.vue", "cfasim-ui/components/src/Hint.md"],
  ["icon", "components", "cfasim-ui/components/src/Icon.vue", "cfasim-ui/components/src/Icon.md"],
  ["number-input", "components", "cfasim-ui/components/src/NumberInput.vue", "cfasim-ui/components/src/NumberInput.md"],
  ["select-box", "components", "cfasim-ui/components/src/SelectBox.vue", "cfasim-ui/components/src/SelectBox.md"],
  ["spinner", "components", "cfasim-ui/components/src/Spinner.vue", "cfasim-ui/components/src/Spinner.md"],
  ["text-input", "components", "cfasim-ui/components/src/TextInput.vue", "cfasim-ui/components/src/TextInput.md"],
  ["toggle", "components", "cfasim-ui/components/src/Toggle.vue", "cfasim-ui/components/src/Toggle.md"],
  ["line-chart", "charts", "cfasim-ui/charts/src/LineChart.vue", "cfasim-ui/charts/src/LineChart.md"],
];

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
  const props = [];
  const propRe = /(\w+)(\?)?:\s*([^;]+);/g;
  let m;
  while ((m = propRe.exec(body)) !== null) {
    props.push({ name: m[1], type: m[3].trim(), required: !m[2] });
  }
  return props;
}

function resolveInterface(script, name) {
  const re = new RegExp(
    `interface\\s+${name}(?:\\s+extends\\s+\\w+)?\\s*\\{`,
  );
  const match = re.exec(script);
  if (!match) return null;
  const braceStart = match.index + match[0].length - 1;
  const braceEnd = findMatchingBrace(script, braceStart);
  if (braceEnd === -1) return null;
  return parsePropsFromTypeBody(script.slice(braceStart + 1, braceEnd));
}

function extractDefineProps(script) {
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
    return resolveInterface(script, namedMatch[1]) ?? [];
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
  const re =
    /defineModel<(\w+)>\s*\(\s*(?:"(\w+)")?\s*(?:,\s*\{[^}]*\})?\s*\)/g;
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
  const props = extractDefineProps(script);
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
      const name = m.name === "modelValue" ? "`v-model`" : `\`v-model:${m.name}\``;
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
      sections.push(`| \`${p.name}\` | \`${escapeType(p.type)}\` | ${req} | ${def} |`);
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

// --- Main ---

// Process components: copy doc + generate API table
for (const [slug, outDir, vuePath, docPath] of components) {
  const dir = resolve(DOCS_ROOT, outDir);
  const apiDir = resolve(dir, "_api");
  mkdirSync(apiDir, { recursive: true });

  copyFileSync(resolve(ROOT, docPath), resolve(dir, `${slug}.md`));

  const meta = analyzeComponent(resolve(ROOT, vuePath));
  const md = generateMarkdown(meta);
  writeFileSync(resolve(apiDir, `${slug}.md`), md);

  console.log(
    `  ${outDir}/${slug}.md (${meta.props.length} props, ${meta.models.length} models, ${meta.emits.length} emits)`,
  );
}

console.log(`\nGenerated docs for ${components.length} components into docs/cfasim-ui/`);
