<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import OptionContent from "../_internal/OptionContent.vue";
import { useOptionLink } from "../_internal/optionLink";
import type { MenuOption, MenuProps } from "./Menu.vue";
import MenuTrigger from "./MenuTrigger.vue";
import "../_internal/option.css";
import "../_internal/listbox.css";

// Menu.vue owns the public API and defaults; this is its lazy dropdown.
defineProps<Required<Omit<MenuProps, "disabled">> & { disabled?: boolean }>();

const open = defineModel<boolean>("open", { required: true });

const emit = defineEmits<{
  select: [item: MenuOption, index: number];
}>();

const { linkHref, navigate } = useOptionLink();

function itemHref(item: MenuOption) {
  return item.disabled ? undefined : linkHref(item);
}

function itemKey(item: MenuOption, index: number) {
  return item.value ?? index;
}
</script>

<template>
  <!-- Non-modal: a modal menu locks body scroll (the page scrollbar
       disappears and comes back), blocks outside clicks and hides the page
       from AT, none of which a menu needs. -->
  <DropdownMenuRoot v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <slot name="trigger">
        <MenuTrigger :icon="icon" :label="label" :disabled="disabled" />
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="Menu cfasim-listbox-content"
        :align="align"
        :side="side"
        :side-offset="4"
        :collision-padding="8"
        :hide-when-detached="true"
      >
        <DropdownMenuItem
          v-for="(item, index) in items"
          :key="itemKey(item, index)"
          :as="itemHref(item) ? 'a' : 'div'"
          :href="itemHref(item)"
          :disabled="item.disabled"
          class="MenuItem"
          :data-danger="item.danger || undefined"
          @select="emit('select', item, index)"
          @click="navigate(item, $event)"
        >
          <OptionContent
            part="main"
            :item="item"
            :index="index"
            :swatch-position="swatchPosition"
            :description-position="descriptionPosition"
          >
            <template v-if="$slots.start" #start>
              <slot name="start" :item="item" :index="index" />
            </template>
            <template v-if="$slots.text" #text>
              <slot name="text" :item="item" :index="index" />
            </template>
          </OptionContent>
          <OptionContent
            part="end"
            :item="item"
            :index="index"
            :swatch-position="swatchPosition"
            :description-position="descriptionPosition"
          >
            <template v-if="$slots.end" #end>
              <slot name="end" :item="item" :index="index" />
            </template>
          </OptionContent>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style>
/* Global: reka's popper wrapper, not the .Menu element, is this component's
   root, so scoped rules on .Menu never matched. */
.Menu {
  --option-line-height: 1.25rem;
  --menu-icon-size: 1rem;
  display: flex;
  flex-direction: column;
  min-width: 11.25rem;
  max-width: min(20rem, var(--reka-dropdown-menu-content-available-width));
  max-height: var(--reka-dropdown-menu-content-available-height);
  overflow-y: auto;
  padding: 0.375rem;
  border-radius: 0.5em;
  box-shadow:
    0 8px 16px -4px rgba(0, 0, 0, 0.15),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  font-size: var(--font-size-sm);
}

/* Same row rhythm and icon size as the chart menu (ChartMenu.vue). */
.MenuItem {
  display: flex;
  align-items: flex-start;
  gap: 0.625em;
  min-height: 2em;
  padding: 0.25rem 0.875rem 0.25rem 0.75rem;
  border-radius: 0.375em;
  line-height: var(--option-line-height);
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  outline: none;
}

.Menu .OptionIcon {
  width: var(--menu-icon-size);
  height: var(--menu-icon-size);
  margin-block: calc((var(--option-line-height) - var(--menu-icon-size)) / 2);
}

.MenuItem[data-highlighted] {
  background-color: color-mix(in srgb, var(--color-text) 8%, transparent);
}

.MenuItem[data-disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.MenuItem[data-danger],
.MenuItem[data-danger] .OptionIcon {
  color: var(--color-danger);
}

.MenuItem[data-danger][data-highlighted] {
  background-color: color-mix(in srgb, var(--color-danger) 12%, transparent);
}
</style>
