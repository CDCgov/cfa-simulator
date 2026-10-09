// Helpers shared by the ChoroplethMap unit test files. Not a test file
// itself (vitest collects `*.test.ts`; Playwright collects `*.spec.ts`).
import { vi } from "vitest";
import type { DOMWrapper, VueWrapper } from "@vue/test-utils";

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
