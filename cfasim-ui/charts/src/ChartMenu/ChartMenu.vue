<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
  type CSSProperties,
} from "vue";

export type ChartMenuIcon =
  "copy" | "download" | "image" | "vector" | "file" | "expand";

export interface ChartMenuItem {
  label: string;
  action: () => void;
  /** Sets aria-pressed on the menu item — use for toggle-style items. */
  ariaPressed?: boolean;
  /** Icon drawn before the label. */
  icon?: ChartMenuIcon;
}

const props = withDefaults(
  defineProps<{
    items: ChartMenuItem[];
    /** Force the dropdown style even when only one item is provided. */
    forceDropdown?: boolean;
    /**
     * When the chart is expanded, the menu trigger is replaced by a
     * persistent close (✕) button that emits `close`.
     */
    isFullscreen?: boolean;
  }>(),
  { forceDropdown: false, isFullscreen: false },
);

const emit = defineEmits<{ (e: "close"): void }>();

const useDropdown = () => props.forceDropdown || props.items.length > 1;

// A hand-rolled menu button (WAI-ARIA menu pattern) rather than a popover
// library, so chart consumers do not bundle one. The menu is teleported to
// <body> and positioned from the trigger's bounding rect: one anchor, one
// placement (below, right-aligned, flipped above when out of room).
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const triggerId = useId();
const menuId = useId();

const MENU_OFFSET = 4;
const VIEWPORT_MARGIN = 4;
const menuStyle = ref<CSSProperties>({});

function positionMenu() {
  const trigger = triggerRef.value;
  const menu = menuRef.value;
  if (!trigger || !menu) return;
  const anchor = trigger.getBoundingClientRect();
  const { width, height } = menu.getBoundingClientRect();
  let top = anchor.bottom + MENU_OFFSET;
  if (
    top + height > window.innerHeight - VIEWPORT_MARGIN &&
    anchor.top - MENU_OFFSET - height >= VIEWPORT_MARGIN
  ) {
    top = anchor.top - MENU_OFFSET - height;
  }
  const left = Math.max(VIEWPORT_MARGIN, anchor.right - width);
  menuStyle.value = { top: `${top}px`, left: `${left}px` };
}

function contains(target: EventTarget | null): boolean {
  return (
    target instanceof Node &&
    (rootRef.value?.contains(target) === true ||
      menuRef.value?.contains(target) === true)
  );
}

function menuItems(): HTMLElement[] {
  return menuRef.value
    ? Array.from(
        menuRef.value.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      )
    : [];
}

function focusItem(index: number) {
  const els = menuItems();
  if (els.length === 0) return;
  els[((index % els.length) + els.length) % els.length].focus();
}

// `focus` is the item to focus once open; `null` focuses the menu itself
// (pointer opens, so no item shows a focus ring until the keyboard is used).
async function openMenu(focus: number | null) {
  open.value = true;
  await nextTick();
  positionMenu();
  if (focus === null) menuRef.value?.focus();
  else focusItem(focus);
}

function closeMenu(restoreFocus = true) {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) triggerRef.value?.focus();
}

function onTriggerClick() {
  if (open.value) closeMenu();
  else void openMenu(null);
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    void openMenu(0);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    void openMenu(-1);
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  const current = menuItems().indexOf(document.activeElement as HTMLElement);
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      focusItem(current + 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      focusItem(current < 0 ? -1 : current - 1);
      break;
    case "Home":
      event.preventDefault();
      focusItem(0);
      break;
    case "End":
      event.preventDefault();
      focusItem(-1);
      break;
    case "Escape":
      event.preventDefault();
      closeMenu();
      break;
    case "Tab":
      // Put focus back on the trigger before the default Tab action runs,
      // so it lands on the element after the chart rather than wherever the
      // teleported menu sat in the document.
      closeMenu();
      break;
  }
}

function onItemClick(item: ChartMenuItem) {
  closeMenu();
  item.action();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!contains(event.target)) closeMenu(false);
}

function onFocusOut(event: FocusEvent) {
  // A null relatedTarget is a blur with no new focus target: Safari and
  // Firefox on macOS do not focus buttons on mousedown, so clicking the
  // trigger to close the menu looks like this. The document pointerdown
  // listener handles real outside clicks.
  if (event.relatedTarget !== null && !contains(event.relatedTarget)) {
    closeMenu(false);
  }
}

// Scrolling any ancestor moves the trigger; capture on document sees them all.
function listen() {
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("scroll", positionMenu, true);
  window.addEventListener("resize", positionMenu);
}

function unlisten() {
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  document.removeEventListener("scroll", positionMenu, true);
  window.removeEventListener("resize", positionMenu);
}

watch(open, (isOpen) => (isOpen ? listen() : unlisten()));

onBeforeUnmount(unlisten);

// Dropping to a single item (or into fullscreen) unmounts the menu.
watch(
  () => [useDropdown(), props.isFullscreen],
  ([dropdown, fullscreen]) => {
    if (!dropdown || fullscreen) open.value = false;
  },
);
</script>

<template>
  <div
    ref="rootRef"
    class="chart-menu-trigger-area"
    :class="{ 'chart-menu-trigger-area--expanded': isFullscreen }"
    @focusout="onFocusOut"
  >
    <!-- Expanded: a close button replaces the menu trigger -->
    <button
      v-if="isFullscreen"
      class="chart-menu-button chart-close-button"
      aria-label="Collapse"
      @click="emit('close')"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
    <!-- Single item: plain button -->
    <button
      v-else-if="!useDropdown()"
      class="chart-menu-button chart-menu-single"
      :aria-label="items[0].label"
      @click="items[0].action"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M7 1v8M3 6l4 4 4-4M2 13h10" />
      </svg>
    </button>
    <!-- Multiple items: dropdown menu -->
    <template v-else>
      <button
        :id="triggerId"
        ref="triggerRef"
        type="button"
        class="chart-menu-button"
        aria-label="Chart options"
        aria-haspopup="menu"
        :aria-expanded="open"
        :aria-controls="open ? menuId : undefined"
        :data-state="open ? 'open' : 'closed'"
        @click="onTriggerClick"
        @keydown="onTriggerKeydown"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      <Teleport to="body">
        <div
          v-if="open"
          :id="menuId"
          ref="menuRef"
          class="chart-menu-content"
          role="menu"
          :aria-labelledby="triggerId"
          tabindex="-1"
          :style="menuStyle"
          @keydown="onMenuKeydown"
          @focusout="onFocusOut"
        >
          <button
            v-for="item in items"
            :key="item.label"
            type="button"
            class="chart-menu-item"
            role="menuitem"
            tabindex="-1"
            :aria-pressed="item.ariaPressed"
            @click="onItemClick(item)"
          >
            <svg
              v-if="item.icon"
              class="chart-menu-item-icon"
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <template v-if="item.icon === 'copy'">
                <rect x="5" y="5" width="8" height="8" rx="1" />
                <path
                  d="M3 9H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"
                />
              </template>
              <path
                v-else-if="item.icon === 'download'"
                d="M7 1v8M3 6l4 4 4-4M2 13h10"
              />
              <template v-else-if="item.icon === 'image'">
                <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
                <circle cx="5" cy="6" r="1" />
                <path d="M12.5 10L9 7l-4 4" />
              </template>
              <template v-else-if="item.icon === 'vector'">
                <path d="M3 11L6 5l3 4 3-6" />
                <circle cx="3" cy="11" r="1.25" />
                <circle cx="6" cy="5" r="1.25" />
                <circle cx="9" cy="9" r="1.25" />
                <circle cx="12" cy="3" r="1.25" />
              </template>
              <path
                v-else-if="item.icon === 'file'"
                d="M3 1h5l3 3v9H3zM8 1v3h3"
              />
              <path v-else d="M8 1h5v5M13 1L8 6M6 13H1V8M1 13l5-5" />
            </svg>
            {{ item.label }}
          </button>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.chart-menu-trigger-area {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  z-index: 1;
}

/* In fullscreen the button anchors to the viewport corner (the wrapper's
   content padding doesn't move an absolutely-positioned child), so inset it
   further for modal-style breathing room. */
.chart-menu-trigger-area--expanded {
  top: 1.25em;
  right: 1.25em;
}

.chart-menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 0.375em;
  background: var(--color-bg-0, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  color: var(--color-text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.chart-menu-button[data-state="open"] {
  opacity: 1;
}

/* The close button is always visible while the chart is expanded. */
.chart-close-button {
  opacity: 1;
}

.chart-menu-button:hover {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
  color: var(--color-text);
}

.chart-menu-content {
  position: fixed;
  z-index: 100;
  min-width: 180px;
  padding: 0.375em;
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.5em;
  box-shadow:
    0 8px 16px -4px rgba(0, 0, 0, 0.15),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  outline: none;
}

.chart-menu-item {
  display: flex;
  align-items: center;
  gap: 0.625em;
  width: 100%;
  min-height: 2em;
  padding: 0.25em 0.875em 0.25em 0.75em;
  border: none;
  border-radius: 0.375em;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  user-select: none;
  outline: none;
  white-space: nowrap;
}

.chart-menu-item:hover,
.chart-menu-item:focus {
  background: var(--color-primary);
  color: white;
}

.chart-menu-item-icon {
  flex: none;
}
</style>

<style>
/* Reveal the menu button when the user hovers/focuses anywhere in the
   chart. These reference the parent wrapper classes, so they can't be
   scoped to ChartMenu. (In fullscreen the menu button is swapped for the
   always-visible close button, so no rule is needed there.) */
.line-chart-wrapper:hover .chart-menu-button,
.bar-chart-wrapper:hover .chart-menu-button,
.choropleth-wrapper:hover .chart-menu-button,
.line-chart-wrapper:focus-within .chart-menu-button,
.bar-chart-wrapper:focus-within .chart-menu-button,
.choropleth-wrapper:focus-within .chart-menu-button {
  opacity: 1;
}

/* Visually-hidden live region used by each chart wrapper to announce
   expansion. Lives here so it ships once with the shared menu. */
.chart-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
