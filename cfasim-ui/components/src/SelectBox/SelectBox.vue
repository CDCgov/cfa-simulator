<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  useId,
} from "reka-ui";

export interface SelectOption {
  value: string;
  label: string;
}

const model = defineModel<string>();

const props = defineProps<{
  label?: string;
  hideLabel?: boolean;
  ariaLabel?: string;
  options: SelectOption[];
  placeholder?: string;
}>();

const id = useId();
</script>

<template>
  <div class="select-box">
    <label
      v-if="label"
      :id="`${id}-label`"
      class="select-label"
      :class="{ 'visually-hidden': hideLabel }"
      >{{ label }}</label
    >
    <SelectRoot v-model="model">
      <SelectTrigger
        class="select-trigger"
        :aria-labelledby="props.label ? `${id}-label` : undefined"
        :aria-label="!props.label ? props.ariaLabel : undefined"
      >
        <SelectValue :placeholder="placeholder" />
        <span class="select-icon" aria-hidden="true">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="select-content"
          position="popper"
          :side-offset="4"
          :body-lock="false"
        >
          <SelectViewport class="select-viewport">
            <SelectItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              class="select-item"
            >
              <SelectItemText>{{ opt.label }}</SelectItemText>
              <SelectItemIndicator class="select-indicator">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M2 6L5 9L10 3" />
                </svg>
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>

<style scoped>
.select-box {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.select-label {
  font-size: var(--font-size-sm);
}

.select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
  font-size: var(--font-size-sm);
  height: 2.5em;
  padding: 0 0.75em;
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  background: var(--color-bg-0);
  cursor: pointer;
  width: auto;
  font-family: inherit;
  color: inherit;
  line-height: 1.4;
}

.select-trigger:hover {
  border-color: var(--color-border-hover);
}

.select-trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.select-trigger[data-placeholder] {
  color: var(--color-text-secondary);
}

.select-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
</style>

<style>
.select-content {
  z-index: 100;
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  min-width: var(--reka-select-trigger-width);
  max-height: var(--reka-select-content-available-height);
}

.select-viewport {
  padding: 0.25em;
}

.select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
  padding: 0.25em 0.5em;
  border-radius: 0.25em;
  font-size: var(--font-size-sm);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  outline: none;
}

.select-item[data-highlighted] {
  background: var(--color-primary);
  color: white;
}

.select-item[data-state="checked"] {
  font-weight: 600;
}

.select-indicator {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
</style>
