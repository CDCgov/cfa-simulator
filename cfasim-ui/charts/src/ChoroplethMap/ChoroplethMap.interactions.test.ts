import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { isTouchDevice } from "../_shared/touch.js";
import ChoroplethMap from "./ChoroplethMap.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import {
  autoUnmount,
  finishZoomAnimation,
  flushFrame,
  statesTopo,
  countyFixtureTopo,
  dispatchTouch,
  strokeStyle,
  pathFor,
  clickSelect,
  hsaMapping,
} from "./ChoroplethMap.testUtils.js";

vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

const baseProps = { topology: statesTopo, width: 600, height: 400 };

describe("ChoroplethMap selection and focus", () => {
  it("emits stateClick and toggles update:focus on click", async () => {
    const wrapper = mount(ChoroplethMap, { props: baseProps });
    const california = pathFor(wrapper, "06");
    await clickSelect(california);
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    expect(wrapper.emitted("update:focus")![0][0]).toBe("06");

    await wrapper.setProps({ focus: "California" });
    await clickSelect(california);
    expect(wrapper.emitted("update:focus")![1][0]).toBeNull();
  });

  it("zooms and highlights on focus, preserves transform on unfocus, and respects focusZoom=false", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { ...baseProps, focus: "06", focusZoomLevel: 5 },
    });
    await flushPromises();
    const transformBefore = wrapper.find("g").attributes("transform") ?? "";
    expect(transformBefore).toContain("scale(5)");
    expect(strokeStyle(pathFor(wrapper, "06"))).toContain(
      "choropleth-highlight",
    );

    await wrapper.setProps({ focus: null });
    await flushPromises();
    await finishZoomAnimation();
    expect(wrapper.find("g").attributes("transform")).toBe(transformBefore);

    const staticFocus = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        focus: { id: "06", stroke: "red", strokeWidth: 3 },
        focusZoom: false,
      },
    });
    expect(strokeStyle(pathFor(staticFocus, "06"))).toBe("red");
    expect(staticFocus.find("g").attributes("transform")).toBeUndefined();
  });

  it("renders and clears cross-geoType FocusItem overlays", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        ...baseProps,
        hsaMapping,
        topology: countyFixtureTopo,
        geoType: "hsas",
        focus: [
          { id: "060766", geoType: "hsas" },
          { id: "06037", geoType: "counties", style: "dashed", stroke: "#666" },
        ],
      },
    });
    await flushPromises();
    const overlay = wrapper.find(".focus-overlay");
    expect(overlay.attributes("stroke")).toBe("#666");
    expect(overlay.attributes("stroke-dasharray")).toBe("8 4");
    expect(overlay.attributes("pointer-events")).toBe("none");

    await wrapper.setProps({ focus: null });
    await flushPromises();
    expect(wrapper.findAll(".focus-overlay")).toHaveLength(0);
  });
});

describe("ChoroplethMap hover and tooltips", () => {
  it("renders #tooltip slot and toggles it reactively", async () => {
    const showSlot = ref(true);
    const Parent = defineComponent({
      setup() {
        return () =>
          h(
            ChoroplethMap,
            { ...baseProps, data: [{ id: "06", value: 42 }] },
            showSlot.value
              ? {
                  tooltip: ({
                    name,
                    value,
                  }: {
                    name: string;
                    value: unknown;
                  }) =>
                    h("div", { class: "custom-tip" }, `${name} :: ${value}`),
                }
              : {},
          );
      },
    });
    const wrapper = mount(Parent, { attachTo: document.body });
    const california = pathFor(wrapper, "06");
    expect(california.find("title").exists()).toBe(false);
    expect(california.attributes("aria-label")).toBe("California: 42");

    await california.trigger("mouseover");
    await flushPromises();
    const tip = document.body.querySelector(".custom-tip")!;
    expect(tip.textContent).toBe("California :: 42");
    expect((tip.parentElement as HTMLElement).style.visibility).toBe("visible");

    await california.trigger("mouseout");
    await flushPromises();
    expect((tip.parentElement as HTMLElement).style.visibility).toBe("hidden");

    showSlot.value = false;
    await nextTick();
    await flushPromises();
    expect(pathFor(wrapper, "06").find("title").exists()).toBe(true);
    expect(document.body.querySelector(".chart-tooltip-content")).toBeNull();
  });

  it("suppresses hover tooltips through resize and dismisses on map scroll", async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(ChoroplethMap, {
        attachTo: document.body,
        props: {
          ...baseProps,
          tooltipTrigger: "hover",
          data: [{ id: "06", value: 42 }],
        },
      });
      const california = pathFor(wrapper, "06");
      await california.trigger("mouseover", { clientX: 100, clientY: 100 });
      const tip = document.body.querySelector<HTMLElement>(
        ".chart-tooltip-content",
      )!;
      expect(tip.style.visibility).toBe("visible");

      window.dispatchEvent(new Event("resize"));
      expect(tip.style.visibility).toBe("hidden");
      await california.trigger("mouseover", { clientX: 100, clientY: 100 });
      expect(tip.style.visibility).toBe("hidden");

      vi.advanceTimersByTime(250);
      california.element.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 102,
          clientY: 101,
        }),
      );
      await flushPromises();
      expect(tip.style.visibility).toBe("visible");

      document.dispatchEvent(new Event("scroll"));
      expect(tip.style.visibility).toBe("hidden");
    } finally {
      vi.useRealTimers();
    }
  });

  it("flips and clamps tooltip near the window edge on hover and mousemove", async () => {
    const observers: { cb: ResizeObserverCallback; targets: Element[] }[] = [];
    class FakeRO {
      targets: Element[] = [];
      constructor(public cb: ResizeObserverCallback) {
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", FakeRO);
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    try {
      const wrapper = mount(ChoroplethMap, {
        attachTo: document.body,
        props: {
          ...baseProps,
          tooltipTrigger: "hover",
          tooltipClamp: "window",
          data: [{ id: "06", value: 42 }],
        },
      });
      await flushPromises();
      const tip = document.body.querySelector<HTMLElement>(
        ".chart-tooltip-content",
      )!;
      const tipRO = observers.find((obs) => obs.targets.includes(tip))!;
      tipRO.cb(
        [
          {
            borderBoxSize: [{ inlineSize: 300, blockSize: 40 }],
            contentRect: { width: 277, height: 17 },
          } as unknown as ResizeObserverEntry,
        ],
        tipRO as unknown as ResizeObserver,
      );
      const parseX = () =>
        Number(
          /translate3d\((-?[\d.]+)px/.exec(tip.style.transform)?.[1] ?? "NaN",
        );
      const california = pathFor(wrapper, "06");
      await california.trigger("mouseover", { clientX: 950, clientY: 200 });
      expect(parseX() + 300).toBeLessThanOrEqual(950 - 16);

      california.element.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 948,
          clientY: 205,
        }),
      );
      await flushFrame();
      expect(parseX() + 300).toBeLessThanOrEqual(1000);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("ChoroplethMap zoom, controls, and stroke compensation", () => {
  it("steps zoom with +/- controls, resets view, and retires the hint", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { ...baseProps, zoom: true },
    });
    expect(wrapper.find(".choropleth-zoom-hint").text()).toBe(
      "Double click to zoom",
    );
    expect(
      wrapper.find('[aria-label="Reset view"]').attributes("disabled"),
    ).toBeDefined();

    await wrapper.find('[aria-label="Zoom in"]').trigger("click");
    await finishZoomAnimation();
    await flushPromises();
    expect(wrapper.find("g").attributes("transform")).toContain("scale(2)");
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(false);

    await wrapper.find('[aria-label="Reset view"]').trigger("click");
    await finishZoomAnimation();
    expect(wrapper.find("g").attributes("transform")).toContain("scale(1)");
  });

  it("ignores wheel inline by default, zooms on wheel in scroll mode, and toggles fullscreen hint", async () => {
    const inline = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { ...baseProps, zoom: true },
    });
    const inlineSvg = inline.find(".state-path").element.closest("svg")!;
    inlineSvg.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -120,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(inline.find("g").attributes("transform")).toBeUndefined();

    const scrollMap = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { ...baseProps, zoom: true, zoomMode: "scroll" },
    });
    const svg = scrollMap.find(".state-path").element.closest("svg")!;
    (svg as unknown as { createSVGPoint?: unknown }).createSVGPoint = undefined;
    svg.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -120,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    const scale = parseFloat(
      /scale\(([\d.]+)\)/.exec(
        scrollMap.find("g").attributes("transform") ?? "",
      )?.[1] ?? "1",
    );
    expect(scale).toBeGreaterThan(1);

    const expand = inline
      .findComponent(ChartMenu)
      .props("items")
      .find((item) => item.label === "Fullscreen")!;
    expand.action();
    await inline.vm.$nextTick();
    expect(inline.find(".choropleth-zoom-hint").exists()).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await inline.vm.$nextTick();
    expect(inline.find(".choropleth-zoom-hint").exists()).toBe(true);
  });

  it("cancels deferred click selection when double-click lands", () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(ChoroplethMap, {
        props: { ...baseProps, zoom: true },
      });
      const el = wrapper.find(".state-path").element;
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
      vi.advanceTimersByTime(400);
      expect(wrapper.emitted("stateClick")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("compensates stroke widths for zoom scale without vector-effect and supports tightFit", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { ...baseProps, focus: "06", focusZoomLevel: 5 },
    });
    await flushPromises();
    const svg = wrapper.find(".state-path").element.closest("svg")!;
    expect(svg.querySelector("[vector-effect]")).toBeNull();
    expect(svg.querySelector("g > g")!.getAttribute("stroke-width")).toBe(
      "0.1",
    );
    expect(pathFor(wrapper, "06").attributes("stroke-width")).toBe("0.3");

    const minPathX = (d: string) =>
      Math.min(
        ...[...d.matchAll(/(-?[\d.]+),-?[\d.]+/g)].map((m) => Number(m[1])),
      );
    const tight = mount(ChoroplethMap, {
      props: { topology: statesTopo, geoType: "states", tightFit: true },
    });
    await flushPromises();
    expect(
      minPathX(pathFor(wrapper, "02").attributes("d")!),
    ).toBeGreaterThanOrEqual(0);
    expect(minPathX(pathFor(tight, "02").attributes("d")!)).toBeLessThan(0);
  });
});

describe("ChoroplethMap touch interactions", () => {
  afterEach(() => {
    vi.mocked(isTouchDevice).mockReturnValue(false);
  });

  function tap(el: Element, x = 100, y = 100) {
    dispatchTouch(el, "touchstart", [{ clientX: x, clientY: y }]);
    dispatchTouch(el, "touchend", [{ clientX: x, clientY: y }]);
  }

  it("selects on tap and ignores drags and multi-touch pinches", () => {
    const wrapper = mount(ChoroplethMap, { props: baseProps });
    const el = wrapper.find(".state-path").element;

    dispatchTouch(el, "touchstart", [{ clientX: 100, clientY: 100 }]);
    dispatchTouch(el, "touchend", [{ clientX: 100, clientY: 140 }]);
    expect(wrapper.emitted("stateClick")).toBeUndefined();

    dispatchTouch(el, "touchstart", [
      { clientX: 100, clientY: 100 },
      { clientX: 150, clientY: 150 },
    ]);
    dispatchTouch(el, "touchend", [{ clientX: 100, clientY: 100 }]);
    expect(wrapper.emitted("stateClick")).toBeUndefined();

    tap(el);
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    expect(wrapper.emitted("update:focus")).toHaveLength(1);
  });

  it("expands on double-tap with bottom-sheet tooltip and resets zoom on close", async () => {
    vi.mocked(isTouchDevice).mockReturnValue(true);
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        ...baseProps,
        zoom: true,
        tooltipTrigger: "hover",
        data: [{ id: "06", value: 42 }],
      },
    });
    const california = pathFor(wrapper, "06").element;
    tap(california);
    tap(california);
    await flushPromises();
    expect(
      document
        .querySelector(".choropleth-wrapper")
        ?.classList.contains("is-fullscreen"),
    ).toBe(true);
    await finishZoomAnimation();

    tap(california);
    await flushPromises();
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    const sheet = document.querySelector<HTMLElement>(".chart-tooltip-sheet")!;
    expect(sheet.classList.contains("is-open")).toBe(true);
    expect(sheet.textContent).toContain("California");

    document.querySelector<HTMLElement>(".chart-close-button")!.click();
    await flushPromises();
    expect(
      document
        .querySelector(".choropleth-wrapper")
        ?.classList.contains("is-fullscreen"),
    ).toBe(false);
    const mapSvg = document.querySelector(".state-path")!.closest("svg")!;
    expect(mapSvg.querySelector("g")!.getAttribute("transform")).toContain(
      "scale(1)",
    );
  });

  it("zooms in place without fullscreen when touchExpand is false", async () => {
    vi.mocked(isTouchDevice).mockReturnValue(true);
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { ...baseProps, zoom: true, touchExpand: false },
    });
    const el = wrapper.find(".state-path").element;
    tap(el);
    tap(el);
    await finishZoomAnimation();
    await flushPromises();
    expect(
      document.querySelector(".choropleth-wrapper.is-fullscreen"),
    ).toBeNull();
    expect(wrapper.find("g").attributes("transform")).toContain("scale(2)");
  });
});
