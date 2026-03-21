<script setup lang="ts">
export type BoxVariant = "info" | "success" | "warning" | "error";

defineProps<{
  variant?: BoxVariant;
  bgColor?: string;
  textColor?: string;
  role?: string;
}>();
</script>

<template>
  <div
    class="box"
    :class="variant ? `box-${variant}` : undefined"
    :style="{
      backgroundColor: bgColor,
      color: textColor,
    }"
    :role="role"
  >
    <slot />
  </div>
</template>

<style scoped>
.box {
  padding: 0.75em 1.25em;
  border-radius: 0.375em;
  font-size: var(--font-size-sm);
}

.box-info {
  background-color: var(--color-box-info-bg);
  color: var(--color-box-info-text);
}

.box-success {
  background-color: var(--color-box-success-bg);
  color: var(--color-box-success-text);
}

.box-warning {
  background-color: var(--color-box-warning-bg);
  color: var(--color-box-warning-text);
}

.box-error {
  background-color: var(--color-box-error-bg);
  color: var(--color-box-error-text);
}
</style>
