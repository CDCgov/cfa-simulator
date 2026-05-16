<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import Spinner from "../Spinner/Spinner.vue";

export type ParamEditorFormat = "json" | "toml" | "yaml";
export type ParamEditorValue = Record<string, unknown>;

defineProps<{
  value: ParamEditorValue;
  format?: ParamEditorFormat;
  height?: string;
  /** Basename for the Export download (no extension). Defaults to
   *  `params-YYYYMMDD-HHMMSS` computed at click time. */
  filename?: string;
}>();

defineEmits<{
  apply: [value: ParamEditorValue];
}>();

// The actual editor (CodeMirror + YAML/TOML parsers) is loaded on demand
// the first time this component mounts, so consumers that never open the
// editor never pay for the ~200KB gzipped of editor + language code.
const Impl = defineAsyncComponent({
  loader: () => import("./ParamEditorImpl.vue"),
  loadingComponent: Spinner,
  delay: 100,
});
</script>

<template>
  <Impl
    :value="value"
    :format="format"
    :height="height"
    :filename="filename"
    @apply="$emit('apply', $event)"
  />
</template>
