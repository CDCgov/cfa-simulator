<script lang="ts">
import { shallowRef } from "vue";
import type { Component } from "vue";

// The dropdown (reka DropdownMenu and its popper chain, ~26 KB gz) loads the
// first time a Menu mounts, so a List without menus does not pay for it.
// Module scope: once loaded, every later Menu renders the real one at once.
const Impl = shallowRef<Component | null>(null);
let loading: Promise<void> | null = null;
function loadImpl() {
  loading ??= import("./MenuImpl.vue").then((m) => {
    Impl.value = m.default;
  });
  return loading;
}
</script>

<script setup lang="ts">
import type {
  ListDescriptionPosition,
  ListOption,
  ListSwatchPosition,
} from "../List/List.vue";
import MenuTrigger from "./MenuTrigger.vue";

export interface MenuOption extends ListOption {
  /** Colors the option as destructive, e.g. Delete. */
  danger?: boolean;
}

export interface MenuProps {
  items: MenuOption[];
  /** Icon name for the default trigger button. */
  icon?: string;
  /** Accessible name for the default trigger button. */
  label?: string;
  /** Disables the default trigger button. */
  disabled?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  swatchPosition?: ListSwatchPosition;
  descriptionPosition?: ListDescriptionPosition;
}

const props = withDefaults(defineProps<MenuProps>(), {
  icon: "more_horiz",
  align: "end",
  side: "bottom",
  swatchPosition: "start",
  descriptionPosition: "below",
});

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  select: [item: MenuOption, index: number];
}>();

type RowProps = { item: MenuOption; index: number };
defineSlots<{
  trigger?(): unknown;
  start?(props: RowProps): unknown;
  text?(props: RowProps): unknown;
  end?(props: RowProps): unknown;
}>();

if (!Impl.value) loadImpl();

let warned = false;
function triggerLabel() {
  if (props.label) return props.label;
  if (!warned) {
    warned = true;
    console.warn(
      `[cfasim-ui] Menu: set \`label\` to name the "${props.icon}" button.`,
    );
  }
  return props.icon;
}

// A click before the dropdown has loaded is kept, so it opens on arrival.
function openWhenLoaded() {
  if (!props.disabled) open.value = true;
}
</script>

<template>
  <component
    :is="Impl"
    v-if="Impl"
    v-model:open="open"
    :items="items"
    :icon="icon"
    :label="triggerLabel()"
    :disabled="disabled"
    :align="align"
    :side="side"
    :swatch-position="swatchPosition"
    :description-position="descriptionPosition"
    @select="(item: MenuOption, index: number) => emit('select', item, index)"
  >
    <template v-if="$slots.trigger" #trigger>
      <slot name="trigger" />
    </template>
    <template v-if="$slots.start" #start="p: RowProps">
      <slot name="start" v-bind="p" />
    </template>
    <template v-if="$slots.text" #text="p: RowProps">
      <slot name="text" v-bind="p" />
    </template>
    <template v-if="$slots.end" #end="p: RowProps">
      <slot name="end" v-bind="p" />
    </template>
  </component>
  <span v-else-if="$slots.trigger" class="MenuPending" @click="openWhenLoaded">
    <slot name="trigger" />
  </span>
  <MenuTrigger
    v-else
    :icon="icon"
    :label="triggerLabel()"
    :disabled="disabled"
    @click="openWhenLoaded"
  />
</template>

<style scoped>
.MenuPending {
  display: contents;
}
</style>
