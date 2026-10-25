<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";

const props = withDefaults(
  defineProps<{
    // Mount the preview only once it nears the viewport, so a page of heavy
    // demos (maps) does not render them all on load.
    lazy?: boolean;
    // With `lazy`, also wait for this (e.g. demo data loaded by the page).
    ready?: boolean;
  }>(),
  { lazy: false, ready: true },
);

const preview = useTemplateRef<HTMLElement>("preview");
const visible = ref(!props.lazy);
let observer: IntersectionObserver | undefined;

onMounted(() => {
  if (visible.value || !preview.value) return;
  if (typeof IntersectionObserver === "undefined") {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        visible.value = true;
        observer?.disconnect();
      }
    },
    { rootMargin: "600px 0px" },
  );
  observer.observe(preview.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="component-demo">
    <div
      ref="preview"
      class="demo-preview"
      :class="{ 'is-pending': !(visible && ready) }"
    >
      <slot v-if="visible && ready" />
    </div>
    <div v-if="$slots.code" class="demo-code">
      <slot name="code" />
    </div>
  </div>
</template>

<style scoped>
.component-demo {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  margin: 16px 0;
  overflow: hidden;
}

.demo-preview {
  padding: 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}

/* Roughly a 400px map plus its title and legend, to limit layout shift. */
.demo-preview.is-pending {
  min-height: 480px;
}

.demo-code :deep(div[class*="language-"]) {
  margin: 0;
  border-radius: 0;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
