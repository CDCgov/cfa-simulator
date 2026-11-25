import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useChartSize } from "./useChartSize.js";

/** Stands in for the browser's observer so a test can deliver a size. */
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
              // The chart stylesheet positions the wrapper.
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
    // Computed styles are empty outside the document.
    { attachTo: document.body },
  );
  return {
    ...size,
    isFullscreen,
    wrapper,
    observer: FakeResizeObserver.instances[0],
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

  it("measures the width from the probe and leaves the height alone", () => {
    const chart = mountChart();
    expect(chart.observer.observed).toEqual([chart.widthProbeRef.value]);

    chart.observer.deliver(480, 12);
    expect(chart.measuredWidth.value).toBe(480);
    expect(chart.measuredHeight.value).toBe(0);
    chart.wrapper.unmount();
  });

  it("measures the container while expanded, then the probe again", async () => {
    const chart = mountChart();
    chart.isFullscreen.value = true;
    await nextTick();
    expect(chart.observer.observed).toEqual([chart.containerRef.value]);

    chart.observer.deliver(1200, 700);
    expect(chart.measuredWidth.value).toBe(1200);
    expect(chart.measuredHeight.value).toBe(700);

    chart.isFullscreen.value = false;
    await nextTick();
    expect(chart.observer.observed).toEqual([chart.widthProbeRef.value]);
    chart.wrapper.unmount();
  });

  it("measures the container when it is not the probe's containing block", () => {
    const chart = mountChart({ position: "static" });
    expect(chart.observer.observed).toEqual([chart.containerRef.value]);
    chart.wrapper.unmount();
  });

  it("measures the container when the chart renders no probe", () => {
    const chart = mountChart({ withProbe: false });
    expect(chart.observer.observed).toEqual([chart.containerRef.value]);
    chart.wrapper.unmount();
  });

  it("applies only the last size once the debounce has passed", () => {
    vi.useFakeTimers();
    const chart = mountChart({ debounce: 100 });
    chart.observer.deliver(480, 0);
    vi.advanceTimersByTime(60);
    chart.observer.deliver(320, 0);
    vi.advanceTimersByTime(60);
    expect(chart.measuredWidth.value).toBe(0);

    vi.advanceTimersByTime(40);
    expect(chart.measuredWidth.value).toBe(320);
    chart.wrapper.unmount();
  });

  it("stops observing when the chart unmounts", () => {
    const chart = mountChart();
    chart.wrapper.unmount();
    expect(chart.observer.observed).toEqual([]);
  });
});
