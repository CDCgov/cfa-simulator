<script setup lang="ts">
import { ref, watch } from "vue";
import { useId } from "reka-ui";
import Hint from "../Hint/Hint.vue";
import type { FieldProps } from "../_internal/field";
import "../_internal/input.css";

const model = defineModel<string>();
const local = ref(model.value);

watch(model, (v) => {
  local.value = v;
});

function commit() {
  model.value = local.value;
}

interface Props extends FieldProps {
  placeholder?: string;
}

const props = defineProps<Props>();
const id = useId();
</script>

<template>
  <div :class="props.label ? 'cfasim-input-label' : undefined">
    <!-- `for`, not a wrapping <label>: wrapped, the Hint's button would be
         the first labelable descendant and so the labeled control. -->
    <label
      v-if="props.label"
      :for="id"
      class="cfasim-input-label-row"
      :class="{ 'visually-hidden': props.hideLabel }"
    >
      {{ props.label }}
      <Hint v-if="props.hint && !props.hideLabel" :text="props.hint" />
    </label>
    <input
      :id="id"
      type="text"
      class="cfasim-input"
      v-model="local"
      :placeholder="props.placeholder"
      :aria-label="!props.label ? props.ariaLabel : undefined"
      @blur="commit"
      @keydown.enter="commit"
    />
  </div>
</template>
