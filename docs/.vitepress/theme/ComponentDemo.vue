<template>
  <div class="component-demo">
    <div class="demo-preview">
      <slot />
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

.demo-code :deep(div[class*="language-"]) {
  margin: 0;
  border-radius: 0;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
