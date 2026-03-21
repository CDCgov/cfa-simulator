<script setup lang="ts">
export type SpinnerSize = "sm" | "md" | "lg";

withDefaults(
  defineProps<{
    size?: SpinnerSize;
    label?: string;
  }>(),
  {
    size: "sm",
  },
);
</script>

<template>
  <span
    class="Spinner"
    :data-size="size"
    role="status"
    :aria-label="label ?? 'Loading'"
  />
</template>

<style>
.Spinner {
  display: inline-block;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: cfa-spin 0.6s linear infinite;
  vertical-align: middle;
}

.Spinner[data-size="sm"] {
  width: 14px;
  height: 14px;
}

.Spinner[data-size="md"] {
  width: 20px;
  height: 20px;
}

.Spinner[data-size="lg"] {
  width: 28px;
  height: 28px;
  border-width: 3px;
}

@keyframes cfa-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
