<script setup lang="ts">
import { ref, watch } from "vue";
import Hint from "../Hint/Hint.vue";

const model = defineModel<string>();
const local = ref(model.value);

watch(model, (v) => {
  local.value = v;
});

function commit() {
  model.value = local.value;
}

const props = defineProps<{
  label?: string;
  placeholder?: string;
  hint?: string;
}>();
</script>

<template>
  <label v-if="props.label" class="input-label">
    <span class="input-label-row">
      {{ props.label }}
      <Hint v-if="props.hint" :text="props.hint" />
    </span>
    <input
      type="text"
      v-model="local"
      :placeholder="props.placeholder"
      @blur="commit"
      @keydown.enter="commit"
    />
  </label>
  <div v-else>
    <input
      type="text"
      v-model="local"
      :placeholder="props.placeholder"
      @blur="commit"
      @keydown.enter="commit"
    />
  </div>
</template>

<style scoped>
.input-label {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  font-size: var(--font-size-sm);
}

.input-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

input {
  display: block;
  width: 100%;
  height: 2.5em;
  padding: 0 0.75em;
  font-size: inherit;
  background-color: var(--color-bg-0);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

input:hover {
  border-color: var(--color-border-hover);
}

input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus);
}

input::placeholder {
  color: var(--color-text-tertiary);
}
</style>
