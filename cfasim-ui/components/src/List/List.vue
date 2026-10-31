<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  useId,
} from "reka-ui";
import { computed } from "vue";
import Icon from "../Icon/Icon.vue";
import Menu from "../Menu/Menu.vue";
import type { MenuOption } from "../Menu/Menu.vue";
import OptionContent from "../_internal/OptionContent.vue";
import { useOptionLink } from "../_internal/optionLink";
import "../_internal/option.css";

export interface ListOption {
  /** Identifies the option for `v-model:selected`; also its render key. */
  value?: string | number;
  label: string;
  description?: string;
  /** Icon name shown at the start of the row. */
  icon?: string;
  /** CSS color for a swatch, at the start or end of the row (`swatchPosition`). */
  swatch?: string;
  disabled?: boolean;
  /** Renders the row as a link. */
  href?: string;
  /** vue-router location; renders a link and navigates with the router when one is installed. */
  to?: string;
}

export type ListActionVisibility = "always" | "hover";
export type ListSwatchPosition = "start" | "end";
export type ListDescriptionPosition = "below" | "end";

export interface ListProps {
  items: ListOption[];
  /** Header text. The header renders when this, the `header` slot, or a header action is given. */
  label?: string;
  /** Lets the header collapse the list. */
  collapsible?: boolean;
  /** Icon name for a button in the header, e.g. `add`. */
  headerAction?: string;
  /** Accessible name for the header action button. */
  headerActionLabel?: string;
  /** Icon name for a button on every row, e.g. `more_horiz`. */
  itemAction?: string;
  /** Accessible name for the row action buttons; each gets `": <label>"` appended. */
  itemActionLabel?: string;
  /** Options for a menu opened from the header action (icon `headerAction`, default `more_horiz`). */
  headerMenu?: MenuOption[];
  /** Options for a menu opened from each row's action (icon `itemAction`, default `more_horiz`); a function can vary them per row, and an empty array shows no menu. */
  itemMenu?: MenuOption[] | ((item: ListOption, index: number) => MenuOption[]);
  /** Show the action buttons all the time, or only while the row is hovered or focused. */
  actionVisibility?: ListActionVisibility;
  /** Put swatches at the start of the row, or at the end beside the action. */
  swatchPosition?: ListSwatchPosition;
  /** Put descriptions under the label, or at the end of the row before the swatch and action. */
  descriptionPosition?: ListDescriptionPosition;
  /** Makes rows with a `value` selectable through `v-model:selected`. */
  selectable?: boolean;
  /** Makes rows buttons that emit `item-click`, without selection. */
  clickable?: boolean;
}

const props = withDefaults(defineProps<ListProps>(), {
  actionVisibility: "always",
  swatchPosition: "start",
  descriptionPosition: "below",
});

const open = defineModel<boolean>("open", { default: true });
const selected = defineModel<string | number | undefined>("selected");

const emit = defineEmits<{
  "header-action": [event: MouseEvent];
  "item-action": [item: ListOption, index: number, event: MouseEvent];
  "item-click": [item: ListOption, index: number, event: MouseEvent];
  select: [item: ListOption, index: number];
  "header-menu-select": [option: MenuOption, index: number];
  "item-menu-select": [option: MenuOption, item: ListOption, index: number];
}>();

type RowProps = { item: ListOption; index: number };
const slots = defineSlots<{
  header?(): unknown;
  "header-end"?(): unknown;
  "header-action"?(): unknown;
  start?(props: RowProps): unknown;
  text?(props: RowProps): unknown;
  end?(props: RowProps): unknown;
  action?(props: RowProps): unknown;
}>();

const { linkHref, navigate } = useOptionLink();

const id = useId();
const labelId = `${id}-label`;

const hasHeader = computed(
  () =>
    !!props.label ||
    !!slots.header ||
    !!props.headerAction ||
    !!props.headerMenu?.length ||
    !!slots["header-action"],
);
const isOpen = computed(() => (props.collapsible ? open.value : true));

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[cfasim-ui] List: ${message}`);
}

function itemKey(item: ListOption, index: number) {
  return item.value ?? index;
}

function canSelect(item: ListOption) {
  if (!props.selectable) return false;
  if (item.value === undefined) {
    warnOnce(
      "value",
      "`selectable` needs a `value` on every option; options without one cannot be selected.",
    );
    return false;
  }
  return true;
}

function isSelected(item: ListOption) {
  return canSelect(item) && selected.value === item.value;
}

function rowTag(item: ListOption) {
  if (!item.disabled && linkHref(item)) return "a";
  return canSelect(item) || props.clickable ? "button" : "span";
}

function rowAttrs(item: ListOption) {
  const current = isSelected(item);
  const tag = rowTag(item);
  if (tag === "a") {
    return {
      href: linkHref(item),
      "data-interactive": true,
      "aria-current": current ? "page" : undefined,
    };
  }
  if (tag === "button") {
    return {
      type: "button",
      disabled: item.disabled,
      "data-interactive": true,
      "aria-current": current ? "true" : undefined,
    };
  }
  return {};
}

function onRowClick(item: ListOption, index: number, event: MouseEvent) {
  if (item.disabled) return;
  if (!linkHref(item) && !canSelect(item) && !props.clickable) return;
  emit("item-click", item, index, event);
  if (canSelect(item)) {
    selected.value = item.value;
    emit("select", item, index);
  }
  navigate(item, event);
}
function actionName(label: string | undefined, icon: string, key: string) {
  if (label) return label;
  warnOnce(key, `set \`${key}Label\` to name the "${icon}" button.`);
  return icon;
}

function itemActionName(item: ListOption, index: number) {
  const base = actionName(
    props.itemActionLabel,
    props.itemAction ?? "more_horiz",
    "itemAction",
  );
  return `${base}: ${item.label || index + 1}`;
}

function rowMenu(item: ListOption, index: number) {
  const menu =
    typeof props.itemMenu === "function"
      ? props.itemMenu(item, index)
      : props.itemMenu;
  return menu?.length ? menu : undefined;
}
</script>

<template>
  <CollapsibleRoot
    class="List"
    :open="isOpen"
    :data-action-visibility="actionVisibility"
    @update:open="open = $event"
  >
    <div v-if="hasHeader" class="ListHeader ListRow">
      <CollapsibleTrigger v-if="collapsible" class="ListHeaderTrigger">
        <span class="ListCaret" :data-open="isOpen || undefined" />
        <span :id="labelId" class="ListHeaderLabel">
          <slot name="header">{{ label }}</slot>
        </span>
      </CollapsibleTrigger>
      <span v-else :id="labelId" class="ListHeaderLabel">
        <slot name="header">{{ label }}</slot>
      </span>
      <span v-if="$slots['header-end']" class="OptionEnd">
        <slot name="header-end" />
      </span>
      <span
        v-if="$slots['header-action'] || headerAction || headerMenu?.length"
        class="ListActions"
      >
        <slot name="header-action">
          <Menu
            v-if="headerMenu?.length"
            :items="headerMenu"
            :icon="headerAction ?? 'more_horiz'"
            :label="
              actionName(
                headerActionLabel,
                headerAction ?? 'more_horiz',
                'headerAction',
              )
            "
            @select="(option, i) => emit('header-menu-select', option, i)"
          />
          <button
            v-else
            type="button"
            class="ListAction cfasim-icon-button"
            :aria-label="
              actionName(headerActionLabel, headerAction!, 'headerAction')
            "
            @click="emit('header-action', $event)"
          >
            <Icon :icon="headerAction!" size="sm" />
          </button>
        </slot>
      </span>
    </div>
    <CollapsibleContent class="ListContent">
      <ul
        class="ListItems"
        :aria-labelledby="
          hasHeader && (label || $slots.header) ? labelId : undefined
        "
      >
        <li
          v-for="(item, index) in items"
          :key="itemKey(item, index)"
          class="ListItem ListRow"
          :data-disabled="item.disabled || undefined"
          :data-selected="isSelected(item) || undefined"
        >
          <component
            :is="rowTag(item)"
            v-bind="rowAttrs(item)"
            class="ListMain"
            @click="onRowClick(item, index, $event)"
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
          </component>
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
          <span
            v-if="$slots.action || itemAction || rowMenu(item, index)"
            class="ListActions"
          >
            <slot name="action" :item="item" :index="index">
              <Menu
                v-if="rowMenu(item, index)"
                :items="rowMenu(item, index)!"
                :icon="itemAction ?? 'more_horiz'"
                :label="itemActionName(item, index)"
                :disabled="item.disabled"
                @select="
                  (option) => emit('item-menu-select', option, item, index)
                "
              />
              <button
                v-else
                type="button"
                class="ListAction cfasim-icon-button"
                :aria-label="itemActionName(item, index)"
                :disabled="item.disabled"
                @click="emit('item-action', item, index, $event)"
              >
                <Icon :icon="itemAction!" size="sm" />
              </button>
            </slot>
          </span>
        </li>
      </ul>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
.List {
  /* The label line matches the sm icon, so icons and swatches sit on it. */
  --option-line-height: 1.25rem;
  display: flex;
  flex-direction: column;
  font-size: var(--font-size-sm);
}

.ListRow {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.25rem 0.25rem 0.25rem 0.5rem;
  line-height: var(--option-line-height);
  border-radius: var(--radius-md);
}

.ListHeader {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.ListHeaderTrigger {
  display: flex;
  align-items: center;
  gap: 0.5em;
  flex: 1;
  min-width: 0;
  align-self: stretch;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.ListHeaderTrigger:hover {
  color: var(--color-text);
}

.ListHeaderTrigger:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.ListHeaderLabel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ListCaret {
  flex: none;
  width: 0;
  height: 0;
  border-left: 0.35em solid currentColor;
  border-top: 0.3em solid transparent;
  border-bottom: 0.3em solid transparent;
  transition: transform 0.15s;
}

.ListCaret[data-open] {
  transform: rotate(90deg);
}

.ListContent {
  overflow: hidden;
}

.ListContent[data-state="open"] {
  animation: ListSlideDown 200ms ease-out;
}

.ListContent[data-state="closed"] {
  animation: ListSlideUp 200ms ease-out;
}

@keyframes ListSlideDown {
  from {
    height: 0;
  }
  to {
    height: var(--reka-collapsible-content-height);
  }
}

@keyframes ListSlideUp {
  from {
    height: var(--reka-collapsible-content-height);
  }
  to {
    height: 0;
  }
}

.ListItems {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ListItem {
  position: relative;
  align-items: flex-start;
  margin: 0;
  color: var(--color-text);
}

.ListMain {
  display: contents;
}

.ListMain[data-interactive] {
  display: flex;
  text-decoration: none;
  align-items: flex-start;
  gap: 0.5em;
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  line-height: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

/* Stretch the select button over the whole row; the action and any
   interactive end-slot content sit above it. */
.ListMain[data-interactive]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.ListMain[data-interactive]:focus-visible {
  outline: none;
}

.ListMain[data-interactive]:focus-visible::after {
  box-shadow: var(--shadow-focus);
}

.ListMain[data-interactive]:disabled {
  cursor: not-allowed;
}

.ListItem[data-selected] {
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.ListItem[data-selected]:hover {
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.ListActions,
.ListItem
  :deep(.OptionEnd :is(a, button, input, select, textarea, [tabindex])) {
  position: relative;
  z-index: 1;
}

.ListItem:hover {
  background-color: color-mix(in srgb, var(--color-text) 6%, transparent);
}

.ListItem[data-disabled] {
  opacity: 0.5;
}

/* Action content up to 1.5rem tall centers on the label line without
   growing the row. */
.ListActions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  flex: none;
  height: var(--option-line-height);
  margin-left: auto;
}

/* Hidden with opacity, not display, so the button stays in the tab order
   and appears when focused. Touch screens have no hover, so it stays put. */
@media (hover: hover) {
  .List[data-action-visibility="hover"] .ListActions {
    opacity: 0;
  }

  .List[data-action-visibility="hover"] .ListRow:hover .ListActions,
  .List[data-action-visibility="hover"] .ListRow:focus-within .ListActions,
  .List[data-action-visibility="hover"] .ListActions:has([data-state="open"]) {
    opacity: 1;
  }
}
</style>
