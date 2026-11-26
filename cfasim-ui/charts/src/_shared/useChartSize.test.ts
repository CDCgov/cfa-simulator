import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useChartSize } from "./useChartSize.js";

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  constructor(private callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  disconnect() {
    this.observed = [];
  }
  deliver(width: number, height: number) {
    const entry = {
      target: this.observed[0],
      contentRect: { width, height },
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}

function mountChart(
  options: { withProbe?: boolean; position?: string; debounce?: number } = {},
) {
  const isFullscreen = ref(false);
  let size!: ReturnType<typeof useChartSize>;
  const wrapper = mount(
    defineComponent({
      setup() {
        size = useChartSize({
          debounce: () => options.debounce,
          isFullscreen: () => isFullscreen.value,
        });
        return () =>
          h(
            "div",
            {
              ref: size.containerRef,
              style: { position: options.position ?? "relative" },
            },
            [
              options.withProbe === false
                ? null
                : h("div", { ref: size.widthProbeRef }),
            ],
          );
      },
    }),
    { attachTo: document.body },
  );
  return {
    ...size,
    isFullscreen,
    wrapper,
    observer: FakeResizeObserver.instances.at(-1)!,
  };
}

describe("useChartSize", () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("observes widthProbe normally, switches to container in fullscreen, and disconnects on unmount", async () => {
    const chart = mountChart();
    expect(chart.observer.observed).toEqual([chart.widthProbeRef.value]);
    chart.observer.deliver(480, 12);
    expect([chart.measuredWidth.value, chart.measuredHeight.value]).toEqual([
      480, 0,
    ]);

    chart.isFullscreen.value = true;
    await nextTick();
    expect(chart.observer.observed).toEqual([chart.containerRef.value]);
    chart.observer.deliver(1200, 700);
    expect([chart.measuredWidth.value, chart.measuredHeight.value]).toEqual([
      1200, 700,
    ]);

    chart.wrapper.unmount();
    expect(chart.observer.observed).toEqual([]);
  });

  it("falls back to container when unpositioned or without probe, and debounces updates", () => {
    const unpositioned = mountChart({ position: "static" });
    expect(unpositioned.observer.observed).toEqual([
      unpositioned.containerRef.value,
    ]);
    unpositioned.wrapper.unmount();

    const noProbe = mountChart({ withProbe: false });
    expect(noProbe.observer.observed).toEqual([noProbe.containerRef.value]);
    noProbe.wrapper.unmount();

    vi.useFakeTimers();
    const debounced = mountChart({ debounce: 100 });
    debounced.observer.deliver(480, 0);
    vi.advanceTimersByTime(60);
    debounced.observer.deliver(320, 0);
    vi.advanceTimersByTime(60);
    expect(debounced.measuredWidth.value).toBe(0);
    vi.advanceTimersByTime(40);
    expect(debounced.measuredWidth.value).toBe(320);
    debounced.wrapper.unmount();
  });
});
