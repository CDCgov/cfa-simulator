<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  useTemplateRef,
  onMounted,
  onUnmounted,
} from "vue";
import { Codemirror } from "vue-codemirror";
import { json as jsonLang } from "@codemirror/lang-json";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { toml as tomlMode } from "@codemirror/legacy-modes/mode/toml";
import { EditorView, keymap } from "@codemirror/view";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import Box from "../Box/Box.vue";
import Button from "../Button/Button.vue";
import SelectBox from "../SelectBox/SelectBox.vue";

type Format = "json" | "toml" | "yaml";
type Value = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    value: Value;
    format?: Format;
    height?: string;
    filename?: string;
  }>(),
  { format: "json", height: "320px" },
);

const emit = defineEmits<{ apply: [value: Value] }>();

const formatOptions = [
  { value: "json", label: "JSON" },
  { value: "toml", label: "TOML" },
  { value: "yaml", label: "YAML" },
];

function serialize(v: Value, f: Format): string {
  if (f === "json") return JSON.stringify(v, null, 2);
  if (f === "yaml") return stringifyYaml(v);
  return stringifyToml(v);
}

function parse(t: string, f: Format): Value {
  if (f === "json") return JSON.parse(t) as Value;
  if (f === "yaml") return parseYaml(t) as Value;
  return parseToml(t) as Value;
}

const format = ref<Format>(props.format);
const text = ref(serialize(props.value, format.value));
const error = ref("");

// Clear a previously-surfaced parse error as soon as the text parses
// cleanly again, so the user doesn't have to re-trigger Apply just to
// see the error go away after they fix it.
watch(text, () => {
  if (!error.value) return;
  try {
    parse(text.value, format.value);
    error.value = "";
  } catch {
    // Still broken — keep the error visible.
  }
});

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
const applyShortcut = isMac ? "⌘S" : "Ctrl+S";

// External value updates (e.g., parent Reset) re-seed the editor. We
// compare against the last value we sourced from the parent — not
// against the live editor text — so a parent re-render that hands us a
// fresh object ref with the same contents doesn't clobber whatever the
// user is currently typing.
let lastSeeded = text.value;
watch(
  () => props.value,
  (v) => {
    const next = serialize(v, format.value);
    if (next === lastSeeded) return;
    lastSeeded = next;
    text.value = next;
    error.value = "";
  },
  { deep: true },
);

// Convert text between formats by round-tripping through `parse` →
// `serialize`. If the current text doesn't parse, we keep the old
// format and surface the error.
function onFormatChange(next: string) {
  const target = next as Format;
  if (target === format.value) return;
  try {
    const parsed = parse(text.value, format.value);
    text.value = serialize(parsed, target);
    format.value = target;
    error.value = "";
  } catch (e) {
    error.value = `Cannot switch format: ${(e as Error).message}`;
  }
}

function handleApply() {
  try {
    const parsed = parse(text.value, format.value);
    error.value = "";
    emit("apply", parsed);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// Auto-apply when the editor loses focus, but only when the text parses
// cleanly (we don't want to nag with errors as the user clicks away —
// they can hit Apply explicitly to see what's wrong) and only when the
// parsed value actually differs from `props.value`.
function handleBlur() {
  let parsed: Value;
  try {
    parsed = parse(text.value, format.value);
  } catch {
    return;
  }
  if (serialize(parsed, format.value) === serialize(props.value, format.value))
    return;
  error.value = "";
  emit("apply", parsed);
}

// CodeMirror's contenteditable doesn't fire `blur` when the user clicks
// on a non-focusable element (e.g., empty page area or a chart svg), so
// we watch document pointerdown for clicks outside our wrapper and
// trigger the blur-apply logic ourselves.
const rootRef = useTemplateRef<HTMLElement>("rootRef");

function onDocumentPointerDown(e: PointerEvent) {
  const target = e.target as Node | null;
  if (!rootRef.value || !target) return;
  if (rootRef.value.contains(target)) return;
  handleBlur();
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
});

const extensions = computed(() => [
  format.value === "json"
    ? jsonLang()
    : format.value === "yaml"
      ? yamlLang()
      : StreamLanguage.define(tomlMode),
  EditorView.lineWrapping,
  // Bind Cmd/Ctrl+S to Apply and stop the browser from intercepting it
  // for its own "Save page as…" dialog.
  keymap.of([
    {
      key: "Mod-s",
      preventDefault: true,
      run: () => {
        handleApply();
        return true;
      },
    },
  ]),
]);

// `YYYYMMDD-HHMMSS` in local time — readable, sortable, and filesystem-safe
// on Windows (no colons). Computed at export time so the name reflects
// when the user clicked, not when the editor mounted.
function defaultFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ts =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `params-${ts}`;
}

function handleExport() {
  const ext = format.value === "yaml" ? "yml" : format.value;
  const mime =
    format.value === "json"
      ? "application/json"
      : format.value === "yaml"
        ? "application/yaml"
        : "application/toml";
  const base = props.filename ?? defaultFilename();
  const blob = new Blob([text.value], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

const fileInput = useTemplateRef<HTMLInputElement>("fileInput");

function handleImport() {
  fileInput.value?.click();
}

function inferFormat(filename: string): Format {
  const n = filename.toLowerCase();
  if (n.endsWith(".yaml") || n.endsWith(".yml")) return "yaml";
  if (n.endsWith(".toml")) return "toml";
  return "json";
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const raw = await file.text();
  const inferred = inferFormat(file.name);
  format.value = inferred;
  text.value = raw;
  try {
    parse(raw, inferred);
    error.value = "";
  } catch (err) {
    error.value = (err as Error).message;
  }
  input.value = "";
}
</script>

<template>
  <div ref="rootRef" class="param-editor">
    <div class="param-editor-toolbar">
      <SelectBox
        :model-value="format"
        aria-label="Format"
        :options="formatOptions"
        @update:model-value="(v: string | undefined) => v && onFormatChange(v)"
      />
      <div class="param-editor-actions">
        <Button variant="secondary" @click="handleImport">Import</Button>
        <Button variant="secondary" @click="handleExport">Export</Button>
        <Button @click="handleApply">Apply</Button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".json,.toml,.yaml,.yml,application/json,text/plain"
        class="param-editor-file-input"
        tabindex="-1"
        aria-hidden="true"
        @change="onFileChange"
      />
    </div>
    <Codemirror
      v-model="text"
      :extensions="extensions"
      :style="{ height }"
      :indent-with-tab="false"
      :tab-size="2"
      class="param-editor-cm"
      @blur="handleBlur"
    />
    <div class="param-editor-error-region" role="status">
      <Box v-if="error" variant="error" class="param-editor-error">
        {{ error }}
      </Box>
    </div>
    <p class="param-editor-shortcut-hint">
      Press <kbd>{{ applyShortcut }}</kbd> to apply, or click outside the
      editor.
    </p>
  </div>
</template>

<style scoped>
.param-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  min-width: 0;
}

.param-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  align-items: center;
  justify-content: space-between;
}

.param-editor-actions {
  display: flex;
  gap: 0.25em;
}

.param-editor-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.param-editor-cm {
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  font-size: var(--font-size-sm);
  overflow: hidden;
}

.param-editor-cm :deep(.cm-editor) {
  height: 100%;
  outline: none;
}

.param-editor-cm :deep(.cm-editor.cm-focused) {
  outline: none;
}

.param-editor-cm :deep(.cm-scroller) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
}

.param-editor-error {
  white-space: pre-wrap;
  word-break: break-word;
}

.param-editor-shortcut-hint {
  margin: 0;
  font-size: var(--font-size-xs, 0.75em);
  color: var(--color-text-secondary, #666);
}

.param-editor-shortcut-hint kbd {
  font-family: inherit;
  padding: 0.1em 0.35em;
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  background: var(--color-bg-1, transparent);
  font-size: 0.95em;
}
</style>
