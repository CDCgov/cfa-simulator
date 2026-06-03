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

export interface ChartFullscreenOptions {
  /**
   * Reactive getter for where to teleport the expanded chart. A CSS
   * selector or element; resolves to `"body"` when unset. Teleporting
   * out to the document root is what makes `position: fixed` reliable:
   * a `transform`/`filter`/`contain`/`perspective` on any ancestor would
   * otherwise become the containing block and trap the "fullscreen" box
   * inside it.
   */
  target?: () => string | HTMLElement | undefined;
}

/**
 * Tracks whether the chart is in "expanded" mode (fills the window). The
 * browser Fullscreen API isn't used — avoiding its restrictions
 * (user-gesture requirement, permission policy, iframe sandboxing) and
 * keeping the chart inside the document so the rest of the page stays
 * keyboard-navigable.
 *
 * Resilience is the whole point here, so the layout is driven two ways
 * that don't depend on the CSS cascade:
 *  - `fullscreenStyle` returns the critical layout as an *inline* style
 *    object. Inline styles outrank any class rule regardless of stylesheet
 *    source order, so they beat each chart's scoped `position: relative`
 *    base rule (equal specificity, and the scoped rule often loads last)
 *    and still work even if the consumer never imported the package CSS.
 *  - `teleportTarget` moves the node to the document root so the fixed
 *    positioning resolves against the viewport, not a transformed ancestor.
 * The `.is-fullscreen` class remains on the wrapper only as a hook for the
 * one rule inline styles can't express (ChoroplethMap's SVG stretch).
 */
export function useChartFullscreen(opts: ChartFullscreenOptions = {}) {
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
    label: isFullscreen.value ? "Collapse" : "Fullscreen",
    action: toggle,
    ariaPressed: isFullscreen.value,
  }));

  /**
   * Critical fullscreen layout as inline styles (only while expanded).
   * Bound via `:style` on the chart wrapper so it always wins over the
   * scoped base rule and survives a missing stylesheet import.
   */
  const fullscreenStyle = computed<Record<string, string> | undefined>(() =>
    isFullscreen.value
      ? {
          position: "fixed",
          inset: "0",
          "z-index": "var(--cfasim-z-fullscreen, 1000)",
          background: "var(--color-bg-0, #fff)",
          color: "var(--color-text, inherit)",
          padding: "2em",
          "box-sizing": "border-box",
          display: "flex",
          "flex-direction": "column",
          "justify-content": "center",
        }
      : undefined,
  );

  const teleportTarget = computed<string | HTMLElement>(
    () => opts.target?.() || "body",
  );

  return {
    isFullscreen,
    toggle,
    enter,
    exit,
    menuItem,
    fullscreenStyle,
    teleportTarget,
  };
}
