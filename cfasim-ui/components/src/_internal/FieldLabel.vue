<script setup lang="ts">
import Hint from "../Hint/Hint.vue";

// The visible label for a form field, with the shared hideLabel/hint
// behavior. Renders nothing without a `label`; the parent supplies its
// own class via fallthrough attrs so existing scoped styles keep working.
// It is a <label> only when `htmlFor` names the control. Without `for` a
// label's control is its first labelable descendant, the Hint button, and
// a click on the label text focused it and opened the tooltip (Chrome,
// Firefox); fields with no labelable control name it by `aria-labelledby`
// = `labelId` instead and get a span.
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
  <component
    :is="htmlFor ? 'label' : 'span'"
    v-if="label"
    :id="labelId"
    :for="htmlFor"
    :class="{ 'visually-hidden': hideLabel }"
  >
    {{ label }}
    <Hint v-if="hint && !hideLabel" :text="hint" />
  </component>
</template>
