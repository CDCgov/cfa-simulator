<script setup lang="ts">
import Icon from "../Icon/Icon.vue";
import "../_internal/option.css";

// The default icon trigger on its own: Menu renders it while the dropdown
// chunk loads, and MenuImpl wraps it as the reka DropdownMenuTrigger.
defineProps<{
  icon: string;
  label: string;
  disabled?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="cfasim-icon-button"
    :aria-label="label"
    :disabled="disabled"
  >
    <Icon :icon="icon" size="sm" />
  </button>
</template>
