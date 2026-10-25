<script lang="ts">
import { defineAsyncComponent } from "vue";
import HintTrigger from "./HintTrigger.vue";

// The tooltip (reka-ui Tooltip, which brings floating-ui with it) is loaded
// the first time a Hint mounts, so form fields that never pass a `hint` do
// not pay for it. The bare trigger renders meanwhile, so nothing shifts.
// Module scope, not setup: the async wrapper caches the resolved component,
// so every Hint after the first renders the real trigger synchronously.
const Impl = defineAsyncComponent({
  loader: () => import("./HintImpl.vue"),
  loadingComponent: HintTrigger,
  delay: 0,
});
</script>

<script setup lang="ts">
defineProps<{
  text: string;
}>();
</script>

<template>
  <Impl :text="text" />
</template>
