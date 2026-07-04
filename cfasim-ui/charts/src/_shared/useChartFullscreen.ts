import { computed, onMounted, onUnmounted, ref } from "vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { isTouchDevice } from "./touch.js";

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
 * Pinch-zoom lock (touch devices): a `position: fixed` overlay covers the
 * *layout* viewport, so if the user has pinch-zoomed the page, the
 * expanded chart's corners (controls, ✕) sit outside the visible area.
 * Tightening the viewport meta to `maximum-scale=1` snaps the page zoom
 * back to 1× and holds it while expanded — a pinch should zoom the chart,
 * not the page. The last chart to collapse restores the original content
 * so page zoom (an accessibility feature) comes back. No-op without a
 * viewport meta or on mouse-only devices.
 */
let viewportLockCount = 0;
let savedViewportContent: string | null = null;

function viewportMeta(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
}

function lockViewportZoom() {
  if (typeof document === "undefined" || !isTouchDevice()) return;
  const meta = viewportMeta();
  if (!meta) return;
  if (viewportLockCount === 0) {
    savedViewportContent = meta.getAttribute("content");
    // Append rather than replace so app directives (e.g. viewport-fit for
    // safe-area insets) survive while expanded; a later duplicate key wins.
    const base = savedViewportContent || "width=device-width, initial-scale=1";
    meta.setAttribute("content", `${base}, maximum-scale=1`);
  }
  viewportLockCount++;
}

function unlockViewportZoom() {
  if (typeof document === "undefined") return;
  if (viewportLockCount === 0) return;
  viewportLockCount--;
  if (viewportLockCount === 0) {
    const meta = viewportMeta();
    if (meta && savedViewportContent != null) {
      meta.setAttribute("content", savedViewportContent);
    }
    savedViewportContent = null;
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

  // Visual-viewport pinning. A fixed overlay covers the *layout* viewport,
  // but on a pinch-zoomed page only part of that is visible — and iOS
  // refuses to programmatically reset page zoom (the viewport-meta clamp
  // above is best-effort; it works on Android and older iOS). While
  // expanded, track the visual viewport and pin the overlay to exactly the
  // visible box instead of `inset: 0`, so the chart and its controls are
  // always fully on screen whatever the page zoom.
  const visualBox = ref<Record<string, string> | null>(null);

  function updateVisualBox() {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    // Always box off the visual viewport while it's observable — at 1×
    // this equals inset: 0, and it additionally tracks mobile URL-bar
    // collapse. `inset: 0` remains only as the no-API fallback.
    visualBox.value = {
      top: `${vv.offsetTop}px`,
      left: `${vv.offsetLeft}px`,
      width: `${vv.width}px`,
      height: `${vv.height}px`,
    };
  }

  function watchVisualViewport(on: boolean) {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    if (on) {
      vv.addEventListener("resize", updateVisualBox);
      vv.addEventListener("scroll", updateVisualBox);
      updateVisualBox();
    } else {
      vv.removeEventListener("resize", updateVisualBox);
      vv.removeEventListener("scroll", updateVisualBox);
      visualBox.value = null;
    }
  }

  function setExpanded(value: boolean) {
    if (value === isFullscreen.value) return;
    isFullscreen.value = value;
    if (value && !locked) {
      lockBodyScroll();
      lockViewportZoom();
      watchVisualViewport(true);
      locked = true;
    } else if (!value && locked) {
      unlockBodyScroll();
      unlockViewportZoom();
      watchVisualViewport(false);
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
    // Component torn down while expanded — release the locks so the body
    // doesn't stay frozen and page zoom comes back.
    if (locked) {
      unlockBodyScroll();
      unlockViewportZoom();
      watchVisualViewport(false);
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
          // Pinned to the visual viewport when the page is pinch-zoomed;
          // identical to inset: 0 otherwise.
          ...(visualBox.value ?? { inset: "0" }),
          "z-index": "var(--cfasim-z-fullscreen, 1000)",
          background: "var(--color-bg-0, #fff)",
          color: "var(--color-text, inherit)",
          // Edge-to-edge on touch — padding just frames slivers of the
          // page underneath on small screens; desktop keeps modal-style
          // breathing room.
          padding: isTouchDevice() ? "0" : "2em",
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
