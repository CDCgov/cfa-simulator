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
      // 10 client px per data index, so a 40px drag advances 4 indices.
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

describe("useChartTooltip touch gestures", () => {
  it("does not block the page scroll on touchstart", () => {
    const { handlers } = setup();
    const start = touch(100, 100);
    handlers.touchstart(start);
    // preventDefault on touchstart would cancel scrolling for the whole
    // gesture before we know its direction.
    expect(start.preventDefault).not.toHaveBeenCalled();
  });

  it("scrubs the tooltip on a horizontal drag and suppresses scroll", () => {
    const { handlers, hoverIndex, onHover } = setup();
    handlers.touchstart(touch(100, 100));
    expect(hoverIndex.value).toBe(10);

    const move = touch(140, 105); // dx=40, dy=5 -> horizontal scrub
    handlers.touchmove(move);
    expect(move.preventDefault).toHaveBeenCalled();
    expect(hoverIndex.value).toBe(14);
    expect(onHover).toHaveBeenLastCalledWith({ index: 14 });
  });

  it("lets the page scroll on a vertical drag and hides the tooltip", () => {
    const { handlers, hoverIndex, onHover } = setup();
    handlers.touchstart(touch(100, 100));

    const move = touch(105, 160); // dx=5, dy=60 -> vertical scroll
    handlers.touchmove(move);
    expect(move.preventDefault).not.toHaveBeenCalled();
    expect(hoverIndex.value).toBeNull();
    expect(onHover).toHaveBeenLastCalledWith(null);

    // Once classified as a scroll, later moves stay hands-off.
    const move2 = touch(110, 220);
    handlers.touchmove(move2);
    expect(move2.preventDefault).not.toHaveBeenCalled();
    expect(hoverIndex.value).toBeNull();
  });

  it("keeps tracking under the finger before the slop threshold", () => {
    const { handlers } = setup();
    handlers.touchstart(touch(100, 100));
    const tiny = touch(103, 102); // dx+dy = 5 < slop, undecided
    handlers.touchmove(tiny);
    expect(tiny.preventDefault).not.toHaveBeenCalled();
  });

  it("inverts the scroll/scrub axes when scrubAxis is 'y'", () => {
    const { handlers, hoverIndex } = setup("y");
    handlers.touchstart(touch(100, 100));

    // Vertical drag now scrubs.
    const down = touch(105, 160);
    handlers.touchmove(down);
    expect(down.preventDefault).toHaveBeenCalled();
    expect(hoverIndex.value).not.toBeNull();

    // A fresh horizontal drag scrolls.
    handlers.touchend();
    handlers.touchstart(touch(100, 100));
    const across = touch(160, 105);
    handlers.touchmove(across);
    expect(across.preventDefault).not.toHaveBeenCalled();
    expect(hoverIndex.value).toBeNull();
  });
});

describe("useChartTooltip scrubAxis none", () => {
  it("leaves a drag in either direction to the browser", () => {
    for (const [dx, dy] of [
      [40, 5],
      [5, 40],
    ]) {
      const { handlers, hoverIndex } = setup("none");
      handlers.touchstart(touch(100, 100));
      expect(hoverIndex.value).toBe(10);
      const move = touch(100 + dx, 100 + dy);
      handlers.touchmove(move);
      expect(move.preventDefault).not.toHaveBeenCalled();
      expect(hoverIndex.value).toBeNull();
    }
  });
});

describe("useChartTooltip Escape", () => {
  function escape() {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    return event;
  }

  it("dismisses an open tooltip and records the key press", async () => {
    const { handlers, hoverIndex, onHover, scope, closedByEscape } = setup();
    handlers.mousemove({ clientX: 30, clientY: 0 } as MouseEvent);
    expect(hoverIndex.value).toBe(3);
    await nextTick();
    const event = escape();
    expect(hoverIndex.value).toBeNull();
    expect(onHover).toHaveBeenLastCalledWith(null);
    // useChartFullscreen skips a recorded Escape, so the chart stays
    // expanded. Not prevented: reka popovers ignore a prevented Escape.
    expect(closedByEscape(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    // The next pointer move brings it back.
    handlers.mousemove({ clientX: 30, clientY: 0 } as MouseEvent);
    expect(hoverIndex.value).toBe(3);
    // Disposing the scope removes the listener the open tooltip holds.
    scope.stop();
    expect(closedByEscape(escape())).toBe(false);
  });

  it("leaves Escape alone with no tooltip open", async () => {
    const { handlers, onHover, scope, closedByEscape } = setup();
    handlers.mousemove({ clientX: 30, clientY: 0 } as MouseEvent);
    await nextTick();
    handlers.mouseleave();
    await nextTick();
    onHover.mockClear();
    expect(closedByEscape(escape())).toBe(false);
    expect(onHover).not.toHaveBeenCalled();
    scope.stop();
  });
});
