import { computed, onMounted, onUnmounted, ref } from "vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";

/**
 * Module-level refcount so multiple expanded charts on the same page
 * share one body-scroll lock — the last one to collapse restores the
 * original `overflow` value.
 */
let bodyLockCount = 0;
let savedBodyOverflow = "";

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (bodyLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyLockCount++;
}

function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  if (bodyLockCount === 0) return;
  bodyLockCount--;
  if (bodyLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
  }
}

/**
 * Tracks whether the chart is in "expanded" mode (fills the window via
 * CSS). The browser Fullscreen API isn't used — the consumer wires a
 * `.is-fullscreen` class to its wrapper and the CSS handles positioning,
 * which avoids Fullscreen API restrictions (user-gesture requirement,
 * permission policy, iframe sandboxing) and keeps the chart inside the
 * document so the rest of the page remains keyboard-navigable.
 */
export function useChartFullscreen() {
  const isFullscreen = ref(false);
  let locked = false;

  function setExpanded(value: boolean) {
    if (value === isFullscreen.value) return;
    isFullscreen.value = value;
    if (value && !locked) {
      lockBodyScroll();
      locked = true;
    } else if (!value && locked) {
      unlockBodyScroll();
      locked = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !isFullscreen.value) return;
    // Skip when Esc is closing a menu/dialog layered on top of us so we
    // don't collapse the chart at the same time. Reka's dropdown menu
    // uses a document-level Esc listener and doesn't call preventDefault,
    // so checking the event target is the most reliable signal.
    const t = e.target;
    if (t instanceof Element && t.closest('[role="menu"], [role="dialog"]')) {
      return;
    }
    setExpanded(false);
  }

  function enter() {
    setExpanded(true);
  }
  function exit() {
    setExpanded(false);
  }
  function toggle() {
    setExpanded(!isFullscreen.value);
  }

  onMounted(() => {
    if (typeof document === "undefined") return;
    document.addEventListener("keydown", onKey);
  });
  onUnmounted(() => {
    if (typeof document === "undefined") return;
    document.removeEventListener("keydown", onKey);
    // Component torn down while expanded — release the lock so the body
    // doesn't stay frozen.
    if (locked) {
      unlockBodyScroll();
      locked = false;
    }
  });

  /**
   * Returns a reactive ChartMenuItem ref that flips between Expand and
   * Collapse — shared by useChartMenu and any chart (e.g. ChoroplethMap)
   * that builds its menu list directly.
   */
  const menuItem = computed<ChartMenuItem>(() => ({
    label: isFullscreen.value ? "Collapse" : "Expand",
    action: toggle,
    ariaPressed: isFullscreen.value,
  }));

  return { isFullscreen, toggle, enter, exit, menuItem };
}
