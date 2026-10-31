<script setup lang="ts">
import { ref, watch } from "vue";
import { useId } from "reka-ui";
import FieldLabel from "../_internal/FieldLabel.vue";
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
    <FieldLabel
      class="cfasim-input-label-row"
      :label="props.label"
      :hide-label="props.hideLabel"
      :hint="props.hint"
      :html-for="id"
    />
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
