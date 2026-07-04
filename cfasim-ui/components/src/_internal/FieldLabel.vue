<script setup lang="ts">
import Hint from "../Hint/Hint.vue";

// The visible label for a form field, with the shared hideLabel/hint
// behavior. Renders nothing without a `label`; the parent supplies its
// own class via fallthrough attrs so existing scoped styles keep working.
defineProps<{
  label?: string;
  labelId?: string;
  hideLabel?: boolean;
  hint?: string;
  /** `for` attribute, for fields whose control is a real labelable element. */
  htmlFor?: string;
}>();
</script>

<template>
  <label
    v-if="label"
    :id="labelId"
    :for="htmlFor"
    :class="{ 'visually-hidden': hideLabel }"
  >
    {{ label }}
    <Hint v-if="hint && !hideLabel" :text="hint" />
  </label>
</template>
