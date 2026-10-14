// Helpers shared by the ChoroplethMap unit test files. Not a test file
// itself (vitest collects `*.test.ts`; Playwright collects `*.spec.ts`).
import { vi, afterEach } from "vitest";
import { config, flushPromises } from "@vue/test-utils";
import type { DOMWrapper, VueWrapper } from "@vue/test-utils";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
import type { Topology } from "topojson-specification";
import { usHsaTopology } from "../us-hsa-topology/index.js";

export const statesTopo = usStates as unknown as Topology;
export const countiesTopo = usCounties as unknown as Topology;
export const hsaTopo = usHsaTopology;

/**
 * Unmount every root wrapper a test mounted once it finishes. Leaked
 * instances (ResizeObservers, rAF loops, d3 transitions) pile up across a
 * file and slow every later test, so call this once at the top of each
 * ChoroplethMap test file. Explicit `wrapper.unmount()` calls stay valid.
 */
export function autoUnmount() {
  const live: VueWrapper[] = [];
  config.plugins.VueWrapper.install((wrapper) => {
    if ((wrapper as unknown as { __app?: unknown }).__app) {
      live.push(wrapper as VueWrapper);
    }
    return {};
  });
  afterEach(() => {
    for (const w of live.splice(0)) {
      if (!w.vm.$.isUnmounted) w.unmount();
    }
  });
}

/** HSA mapping is dynamic-imported inside ChoroplethMap to keep the main
 * bundle small. Tests that exercise hsas geoType or cross-geoType focus
 * must await both the dynamic import and the Vue render that follows. */
export async function flushDynamicImports() {
  await vi.dynamicImportSettled();
  await flushPromises();
}

/** happy-dom has no TouchEvent; dispatch a plain bubbling event with the
 * touch lists our handlers read off it. `el` is the path the touch lands on. */
export function dispatchTouch(
  el: Element,
  type: "touchstart" | "touchend" | "touchcancel",
  points: { clientX: number; clientY: number }[],
) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, {
    // `touches` is the set still down; a touchend lifts the last finger.
    touches: type === "touchstart" ? points : [],
    changedTouches: points,
  });
  el.dispatchEvent(ev);
}

/** The overlay layers (cities + state labels) paint on the next rAF after
 * Vue's patch; flush both. */
export async function flushOverlayLayout() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await flushPromises();
}

/** Highlight color is applied as inline style (so the theme-following
 * light-dark() default resolves); read it back off the raw element. */
export const strokeStyle = (w: { element: Element }) =>
  (w.element as SVGPathElement).style.stroke;

/** The rendered path of a feature id. */
export const pathFor = (wrapper: VueWrapper, id: string) =>
  wrapper
    .findAll(".state-path")
    .find((p) => p.attributes("data-feat-id") === id) as DOMWrapper<Element>;

/** Click-select defers by a double-click-sized window so a double-click can
 * zoom instead of selecting; run a click and flush past that window. */
export async function clickSelect(target: {
  trigger: (e: string) => Promise<void>;
}) {
  vi.useFakeTimers();
  try {
    await target.trigger("click");
    vi.advanceTimersByTime(300);
  } finally {
    vi.useRealTimers();
  }
}
