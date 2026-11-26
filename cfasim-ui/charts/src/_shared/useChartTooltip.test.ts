import { describe, it, expect, vi } from "vitest";
import { ref, effectScope, nextTick } from "vue";
import { useChartTooltip } from "./useChartTooltip.js";

function setup(scrubAxis?: "x" | "y" | "none") {
  const containerRef = ref<HTMLElement | null>(null);
  const onHover = vi.fn();
  let api!: ReturnType<typeof useChartTooltip>;
  const scope = effectScope();
  scope.run(() => {
    api = useChartTooltip({
      enabled: () => true,
      pointerToIndex: (clientX) => Math.round(clientX / 10),
      containerRef,
      scrubAxis: scrubAxis ? () => scrubAxis : undefined,
      onHover,
    });
  });
  return { ...api, onHover, scope };
}

function touch(x: number, y: number) {
  return {
    touches: [{ clientX: x, clientY: y }],
    preventDefault: vi.fn(),
  } as unknown as TouchEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("useChartTooltip", () => {
  it("classifies touch drags into horizontal scrub vs vertical scroll and respects scrubAxis", () => {
    const xScrub = setup();
    const start = touch(100, 100);
    xScrub.handlers.touchstart(start);
    expect(start.preventDefault).not.toHaveBeenCalled();

    const horiz = touch(140, 105);
    xScrub.handlers.touchmove(horiz);
    expect(horiz.preventDefault).toHaveBeenCalled();
    expect(xScrub.hoverIndex.value).toBe(14);

    // Vertical drag yields to page scroll and hides tooltip.
    const vertSetup = setup();
    vertSetup.handlers.touchstart(touch(100, 100));
    const vert = touch(105, 160);
    vertSetup.handlers.touchmove(vert);
    expect(vert.preventDefault).not.toHaveBeenCalled();
    expect(vertSetup.hoverIndex.value).toBeNull();

    // scrubAxis='y' inverts; scrubAxis='none' leaves drags to the browser.
    const yScrub = setup("y");
    yScrub.handlers.touchstart(touch(100, 100));
    const down = touch(105, 160);
    yScrub.handlers.touchmove(down);
    expect(down.preventDefault).toHaveBeenCalled();

    const noneScrub = setup("none");
    noneScrub.handlers.touchstart(touch(100, 100));
    const drag = touch(140, 105);
    noneScrub.handlers.touchmove(drag);
    expect(drag.preventDefault).not.toHaveBeenCalled();
    expect(noneScrub.hoverIndex.value).toBeNull();
  });

  it("dismisses an open tooltip on capture-phase Escape without preventing default, and cleans up", async () => {
    const fireEscape = () => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      return event;
    };

    const { handlers, hoverIndex, onHover, scope, closedByEscape } = setup();
    handlers.mousemove({ clientX: 30, clientY: 0 } as MouseEvent);
    await nextTick();
    expect(hoverIndex.value).toBe(3);

    const event = fireEscape();
    expect(hoverIndex.value).toBeNull();
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(closedByEscape(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);

    // Closed tooltip ignores Escape; stopping scope removes the listener.
    expect(closedByEscape(fireEscape())).toBe(false);
    handlers.mousemove({ clientX: 30, clientY: 0 } as MouseEvent);
    await nextTick();
    scope.stop();
    expect(closedByEscape(fireEscape())).toBe(false);
  });
});
