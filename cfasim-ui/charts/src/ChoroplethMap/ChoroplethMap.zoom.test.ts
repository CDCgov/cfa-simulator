import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ChoroplethMap from "./ChoroplethMap.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import {
  autoUnmount,
  statesTopo,
  countiesTopo,
  flushDynamicImports,
  clickSelect,
} from "./ChoroplethMap.testUtils.js";

// Touch detection is probed per event, so tests can flip devices per case.
// happy-dom defaults to a mouse-only environment.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

describe("ChoroplethMap zoom, controls, and tooltip placement", () => {
  it("does not constrain touch-action inline (page scroll passes through)", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    // The map svg is the one carrying the feature paths (menu icons are svgs too).
    const mapSvg = wrapper.find(".state-path").element.closest("svg");
    expect(mapSvg?.getAttribute("style") ?? "").not.toContain("touch-action");
  });

  it("ignores wheel events inline even with zoom enabled", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400, zoom: true },
    });
    const mapSvg = wrapper.find(".state-path").element.closest("svg")!;
    mapSvg.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -120,
        bubbles: true,
        cancelable: true,
      }),
    );
    // d3-zoom never fires, so no transform is ever written to the group.
    expect(wrapper.find("g").attributes("transform")).toBeUndefined();
  });

  it("cancels the deferred selection when a double-click lands", () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(ChoroplethMap, {
        props: { topology: statesTopo, width: 600, height: 400, zoom: true },
      });
      const el = wrapper.find(".state-path").element;
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
      vi.advanceTimersByTime(400);
      // The pair was a double-click zoom, not a select.
      expect(wrapper.emitted("stateClick")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("draws no NaN paths while the lazy HSA module is still loading", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas",
        width: 600,
        height: 400,
      },
    });
    // Before the dynamic import resolves there are no HSA features, so the
    // projection can't be fitted — nothing (incl. the state-borders mesh)
    // may render through it.
    const bad = wrapper
      .findAll("path")
      .filter((p) => (p.attributes("d") ?? "").includes("NaN"));
    expect(bad.length).toBe(0);
    // Once the module lands the real features (and valid paths) appear.
    await flushDynamicImports();
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(100);
    for (const p of wrapper.findAll("path")) {
      expect(p.attributes("d") ?? "").not.toContain("NaN");
    }
  });

  // WebKit regression guards: `vector-effect: non-scaling-stroke` across
  // thousands of paths drops iOS Safari to ~3fps, so strokes are
  // compensated by hand (group-level width ÷ zoom scale ÷ viewBox-to-CSS
  // scale) and the svg gets its own compositor layer while interactive.
  describe("stroke compensation and layer promotion", () => {
    it("renders no vector-effect and inherits width from the base group", () => {
      const wrapper = mount(ChoroplethMap, {
        props: { topology: statesTopo, width: 600, height: 400 },
      });
      const svg = wrapper.find(".state-path").element.closest("svg")!;
      expect(svg.querySelector("[vector-effect]")).toBeNull();
      const baseGroup = svg.querySelector("g > g")!;
      expect(baseGroup.getAttribute("stroke-width")).toBe("0.5");
      expect(
        wrapper.find(".state-path").attributes("stroke-width"),
      ).toBeUndefined();
    });

    it("divides stroke widths by the zoom scale", async () => {
      const wrapper = mount(ChoroplethMap, {
        attachTo: document.body,
        props: {
          topology: statesTopo,
          width: 600,
          height: 400,
          focus: "06",
          focusZoomLevel: 5,
        },
      });
      await flushPromises();
      const svg = wrapper.find(".state-path").element.closest("svg")!;
      const baseGroup = svg.querySelector("g > g")!;
      // Base 0.5 at k=5 → 0.1; the focused highlight (0.5 + 1) → 0.3.
      expect(baseGroup.getAttribute("stroke-width")).toBe("0.1");
      const california = wrapper
        .findAll(".state-path")
        .find((p) => p.attributes("data-feat-id") === "06")!;
      expect(california.attributes("stroke-width")).toBe("0.3");
      wrapper.unmount();
    });

    it("divides stroke widths by the rendered viewBox scale", () => {
      const observers: {
        cb: ResizeObserverCallback;
        targets: Element[];
      }[] = [];
      class FakeRO {
        cb: ResizeObserverCallback;
        targets: Element[] = [];
        constructor(cb: ResizeObserverCallback) {
          this.cb = cb;
          observers.push(this);
        }
        observe(t: Element) {
          this.targets.push(t);
        }
        unobserve() {}
        disconnect() {}
      }
      vi.stubGlobal("ResizeObserver", FakeRO);
      try {
        const wrapper = mount(ChoroplethMap, {
          props: { topology: statesTopo, width: 600, height: 400 },
        });
        const svg = wrapper.find(".state-path").element.closest("svg")!;
        const baseGroup = svg.querySelector("g > g")!;
        expect(baseGroup.getAttribute("stroke-width")).toBe("0.5");
        // The svg renders at 500 CSS px of the 1000-unit viewBox, so
        // attribute widths double to stay visually constant.
        const ro = observers.find((o) => o.targets.includes(svg))!;
        ro.cb(
          [{ contentRect: { width: 500 } } as ResizeObserverEntry],
          ro as unknown as ResizeObserver,
        );
        expect(baseGroup.getAttribute("stroke-width")).toBe("1");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("promotes the svg to its own layer only while interactive", async () => {
      const wrapper = mount(ChoroplethMap, {
        attachTo: document.body,
        props: { topology: statesTopo, width: 600, height: 400, zoom: true },
      });
      const svgEl = () => wrapper.find(".state-path").element.closest("svg")!;
      expect(svgEl().getAttribute("style") ?? "").not.toContain("will-change");
      await wrapper.find('[aria-label="Zoom in"]').trigger("click");
      await new Promise((r) => setTimeout(r, 550));
      await flushPromises();
      expect(svgEl().getAttribute("style") ?? "").toContain(
        "will-change: transform",
      );
      wrapper.unmount();
    });

    // Smallest x-coordinate in a geoPath `d` string (coords are absolute
    // "x,y" pairs). Negative → the feature extends left of the viewBox.
    const minPathX = (d: string): number => {
      let min = Infinity;
      for (const m of d.matchAll(/(-?[\d.]+),-?[\d.]+/g)) {
        const x = Number(m[1]);
        if (x < min) min = x;
      }
      return min;
    };
    const alaskaMinX = (wrapper: ReturnType<typeof mount>): number => {
      const ak = wrapper
        .findAll(".state-path")
        .find((p) => p.attributes("data-feat-id") === "02")!;
      return minPathX(ak.attributes("d")!);
    };
    // Smallest x across every rendered feature (works for any geoType, so it
    // catches Alaska clipping without needing to know its feature id).
    const globalMinX = (wrapper: ReturnType<typeof mount>): number => {
      let min = Infinity;
      for (const p of wrapper.findAll(".state-path")) {
        const d = p.attributes("d");
        if (d) min = Math.min(min, minPathX(d));
      }
      return min;
    };

    it("tightFit crops Alaska's western overhang past the left edge", async () => {
      const base = mount(ChoroplethMap, {
        props: { topology: statesTopo, geoType: "states" },
      });
      await flushPromises();
      // Default full fit: Alaska sits fully inside the viewBox (x ≥ 0).
      expect(alaskaMinX(base)).toBeGreaterThanOrEqual(0);
      base.unmount();

      const tight = mount(ChoroplethMap, {
        props: { topology: statesTopo, geoType: "states", tightFit: true },
      });
      await flushPromises();
      // tightFit fits CONUS to the frame, so Alaska's tail clips off the left.
      expect(alaskaMinX(tight)).toBeLessThan(0);
      tight.unmount();
    });

    it("tightFit as a number crops partway (monotonic in the amount)", async () => {
      const mk = async (tightFit: number | boolean) => {
        const w = mount(ChoroplethMap, {
          props: { topology: statesTopo, geoType: "states", tightFit },
        });
        await flushPromises();
        const x = alaskaMinX(w);
        w.unmount();
        return x;
      };
      const [x0, xHalf, x1] = [await mk(false), await mk(0.5), await mk(1)];
      // More crop → Alaska reaches further past the left edge.
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(xHalf).toBeLessThan(0);
      expect(x1).toBeLessThan(xHalf);
    });

    it("tightFit is a no-op in single-state mode", async () => {
      const base = mount(ChoroplethMap, {
        props: { topology: statesTopo, geoType: "states", state: "Alaska" },
      });
      await flushPromises();
      const baseX = alaskaMinX(base);
      base.unmount();

      const tight = mount(ChoroplethMap, {
        props: {
          topology: statesTopo,
          geoType: "states",
          state: "Alaska",
          tightFit: true,
        },
      });
      await flushPromises();
      // Single-state fit ignores tightFit: the state is fit to its own inset.
      expect(alaskaMinX(tight)).toBeCloseTo(baseX, 1);
      tight.unmount();
    });

    it("tightFit crops Alaska on a national county map", async () => {
      const base = mount(ChoroplethMap, {
        props: { topology: countiesTopo, geoType: "counties" },
      });
      await flushPromises();
      expect(globalMinX(base)).toBeGreaterThan(-1);
      base.unmount();

      const tight = mount(ChoroplethMap, {
        props: { topology: countiesTopo, geoType: "counties", tightFit: true },
      });
      await flushPromises();
      // Alaska counties clip off the left once CONUS fills the frame.
      expect(globalMinX(tight)).toBeLessThan(-1);
      tight.unmount();
    });

    it("tightFit crops Alaska on a national HSA map", async () => {
      // HSA ids aren't FIPS, so AK/HI HSAs are identified via the (lazily
      // loaded) fipsToHsa table — the crop kicks in once that chunk resolves.
      const base = mount(ChoroplethMap, {
        props: { topology: countiesTopo, geoType: "hsas" },
      });
      await flushDynamicImports();
      await flushDynamicImports();
      expect(globalMinX(base)).toBeGreaterThan(-1);
      base.unmount();

      const tight = mount(ChoroplethMap, {
        props: { topology: countiesTopo, geoType: "hsas", tightFit: true },
      });
      await flushDynamicImports();
      await flushDynamicImports();
      expect(globalMinX(tight)).toBeLessThan(-1);
      tight.unmount();
    });
  });

  it("scroll mode zooms on wheel immediately, with no hint", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        zoom: true,
        zoomMode: "scroll",
      },
    });
    // Immediately interactive: controls shown, no activation hint.
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(true);
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(false);
    expect(wrapper.find(".choropleth-wrapper").classes()).toContain("pannable");
    const mapSvg = wrapper.find(".state-path").element.closest("svg")!;
    // happy-dom's SVGPoint lacks matrixTransform; drop createSVGPoint so
    // d3's pointer() falls back to getBoundingClientRect coordinates.
    (mapSvg as unknown as { createSVGPoint?: unknown }).createSVGPoint =
      undefined;
    mapSvg.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -120,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    const transform = wrapper.find("g").attributes("transform") ?? "";
    const k = parseFloat(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? "1");
    expect(k).toBeGreaterThan(1);
    wrapper.unmount();
  });

  it("self-calibrates tooltip position when client coords are visual-viewport based", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        tooltipTrigger: "hover",
        tooltipClamp: "none",
        data: [{ id: "06", value: 42 }],
      },
    });
    const tip = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    const parse = () => {
      const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(
        tip.style.transform,
      )!;
      return { x: Number(m[1]), y: Number(m[2]) };
    };
    // Baseline: no page zoom, no calibration.
    await california.trigger("mouseover", { clientX: 200, clientY: 150 });
    const base = parse();
    // Simulate Safari under pinch-zoom: rects come back in visual space
    // (shifted by the visual-viewport offsets vs the layout-space fixed
    // position), and visualViewport reports the zoom.
    Object.defineProperty(window, "visualViewport", {
      value: { scale: 2, offsetTop: 100, offsetLeft: 50 },
      configurable: true,
    });
    tip.getBoundingClientRect = () => {
      const at = parse();
      return {
        left: at.x - 50,
        top: at.y - 100,
        width: 0,
        height: 0,
      } as DOMRect;
    };
    try {
      await california.trigger("mouseover", { clientX: 200, clientY: 150 });
      const corrected = parse();
      expect(corrected.x).toBeCloseTo(base.x + 50);
      expect(corrected.y).toBeCloseTo(base.y + 100);
    } finally {
      Object.defineProperty(window, "visualViewport", {
        value: undefined,
        configurable: true,
      });
    }
    wrapper.unmount();
  });

  it("re-runs flip/clamp on mousemove, not just on the initial hover", async () => {
    // Regression: moveTooltip used to hardcode the right side (clientX + 16)
    // and skip flip/clamp, so a hover near the right edge flipped left on
    // mouseover then snapped back to the right (overflowing) on the very
    // next mousemove — reading as the tooltip "switching sides" on dense
    // maps and ignoring the window edge.
    const observers: {
      cb: ResizeObserverCallback;
      targets: Element[];
    }[] = [];
    class FakeRO {
      cb: ResizeObserverCallback;
      targets: Element[] = [];
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        observers.push(this);
      }
      observe(t: Element) {
        this.targets.push(t);
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
          topology: statesTopo,
          width: 600,
          height: 400,
          tooltipTrigger: "hover",
          tooltipClamp: "window",
          data: [{ id: "06", value: 42 }],
        },
      });
      await flushPromises();
      const tip = document.body.querySelector<HTMLElement>(
        ".chart-tooltip-content",
      )!;
      // Prime the cached tooltip size with a wide box so a hover near the
      // right window edge flips left.
      const tipRO = observers.find((o) => o.targets.includes(tip))!;
      const tipW = 300;
      tipRO.cb(
        [{ contentRect: { width: tipW, height: 40 } } as ResizeObserverEntry],
        tipRO as unknown as ResizeObserver,
      );
      const parseX = () =>
        Number(
          /translate3d\((-?[\d.]+)px/.exec(tip.style.transform)?.[1] ?? "NaN",
        );

      const california = wrapper
        .findAll(".state-path")
        .find((p) => p.attributes("data-feat-id") === "06")!;
      // Hover near the right edge → flips left (x well left of the pointer).
      await california.trigger("mouseover", { clientX: 950, clientY: 200 });
      const afterHover = parseX();
      expect(afterHover).toBeLessThan(950);
      expect(afterHover + tipW).toBeLessThanOrEqual(1000);

      // A mousemove near the same edge must STAY flipped, not snap to 950+16.
      california.element.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 948,
          clientY: 205,
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
      const afterMove = parseX();
      expect(afterMove).toBeLessThan(948);
      expect(afterMove + tipW).toBeLessThanOrEqual(1000);
      // Pre-fix this would have been 948 + 16 = 964 (overflowing the edge).
      expect(afterMove).not.toBeCloseTo(964);

      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flips using the tooltip's border-box size, keeping clearance from the cursor", async () => {
    // Regression: the size cache read contentRect, which excludes
    // .chart-tooltip-content's padding + border, so a left-flipped tooltip
    // sat ~23px further right than intended — overlapping the cursor.
    const observers: {
      cb: ResizeObserverCallback;
      targets: Element[];
    }[] = [];
    class FakeRO {
      cb: ResizeObserverCallback;
      targets: Element[] = [];
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        observers.push(this);
      }
      observe(t: Element) {
        this.targets.push(t);
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
          topology: statesTopo,
          width: 600,
          height: 400,
          tooltipTrigger: "hover",
          tooltipClamp: "window",
          data: [{ id: "06", value: 42 }],
        },
      });
      await flushPromises();
      const tip = document.body.querySelector<HTMLElement>(
        ".chart-tooltip-content",
      )!;
      const tipRO = observers.find((o) => o.targets.includes(tip))!;
      // Border box 300×40, content box 277×17 (padding + border), as a real
      // browser reports them.
      const borderW = 300;
      tipRO.cb(
        [
          {
            borderBoxSize: [{ inlineSize: borderW, blockSize: 40 }],
            contentRect: { width: 277, height: 17 },
          } as unknown as ResizeObserverEntry,
        ],
        tipRO as unknown as ResizeObserver,
      );

      const california = wrapper
        .findAll(".state-path")
        .find((p) => p.attributes("data-feat-id") === "06")!;
      await california.trigger("mouseover", { clientX: 950, clientY: 200 });
      const x = Number(
        /translate3d\((-?[\d.]+)px/.exec(tip.style.transform)?.[1] ?? "NaN",
      );
      // The flipped tooltip's right edge must clear the cursor by the 16px
      // gap. With the contentRect size this was 957 (7px past the cursor).
      expect(x + borderW).toBeLessThanOrEqual(950 - 16);

      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("re-applies the position when the tooltip resizes while visible", async () => {
    // Regression: hovering feature B places its tooltip with feature A's
    // cached size; the ResizeObserver then only refreshed the cache, so a
    // tooltip wider than its predecessor stayed too far right — sitting on
    // top of the cursor (and past the clamp edge) until the next mousemove.
    const observers: {
      cb: ResizeObserverCallback;
      targets: Element[];
    }[] = [];
    class FakeRO {
      cb: ResizeObserverCallback;
      targets: Element[] = [];
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        observers.push(this);
      }
      observe(t: Element) {
        this.targets.push(t);
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
          topology: statesTopo,
          width: 600,
          height: 400,
          tooltipTrigger: "hover",
          tooltipClamp: "window",
          data: [{ id: "06", value: 42 }],
        },
      });
      await flushPromises();
      const tip = document.body.querySelector<HTMLElement>(
        ".chart-tooltip-content",
      )!;
      const tipRO = observers.find((o) => o.targets.includes(tip))!;
      const measure = (w: number, h: number) =>
        tipRO.cb(
          [
            {
              borderBoxSize: [{ inlineSize: w, blockSize: h }],
              contentRect: { width: w - 23, height: h - 23 },
            } as unknown as ResizeObserverEntry,
          ],
          tipRO as unknown as ResizeObserver,
        );
      const parseX = () =>
        Number(
          /translate3d\((-?[\d.]+)px/.exec(tip.style.transform)?.[1] ?? "NaN",
        );

      // Hover with a narrow cached size → flips left based on 60px.
      measure(60, 40);
      const california = wrapper
        .findAll(".state-path")
        .find((p) => p.attributes("data-feat-id") === "06")!;
      await california.trigger("mouseover", { clientX: 950, clientY: 200 });
      expect(parseX()).toBeCloseTo(950 - 16 - 60);

      // The committed content is actually 300px wide → the observer fires
      // and must re-place the tooltip so it still clears the cursor.
      measure(300, 40);
      expect(parseX()).toBeCloseTo(950 - 16 - 300);

      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the tooltip through a plain click once drag-pan is live", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        zoom: true,
        focus: "06",
        tooltipTrigger: "hover",
        data: [{ id: "06", value: 42 }],
      },
    });
    await flushPromises();
    const mapSvg = wrapper.find(".state-path").element.closest("svg")!;
    // happy-dom's SVGPoint lacks matrixTransform; drop createSVGPoint so
    // d3's pointer() falls back to getBoundingClientRect coordinates.
    (mapSvg as unknown as { createSVGPoint?: unknown }).createSVGPoint =
      undefined;
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    await california.trigger("mouseover", { clientX: 100, clientY: 100 });
    const tip = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    expect(tip.style.visibility).toBe("visible");
    // A motionless press-and-release opens/closes a d3 gesture (drag-pan
    // is unlocked after the focus zoom) — it must not eat the tooltip.
    california.element.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        view: window,
        clientX: 100,
        clientY: 100,
      }),
    );
    window.dispatchEvent(
      new MouseEvent("mouseup", {
        view: window,
        clientX: 100,
        clientY: 100,
      }),
    );
    await flushPromises();
    expect(tip.style.visibility).toBe("visible");
    wrapper.unmount();
  });

  it("clicks still select while a zoom animation is in flight", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { topology: statesTopo, width: 600, height: 400, zoom: true },
    });
    await flushPromises();
    // Kick off the 450ms focus-zoom animation...
    await wrapper.setProps({ focus: "06" });
    await new Promise((r) => setTimeout(r, 50));
    // ...and click a different state mid-animation.
    const texas = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "48")!;
    texas.element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, detail: 1 }),
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    wrapper.unmount();
  });

  it("reset returns to full extent, clears focus, and keeps the controls", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        zoom: true,
        focus: "06",
      },
    });
    await flushPromises();
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(true);
    await wrapper.find('[aria-label="Reset view"]').trigger("click");
    expect(wrapper.emitted("update:focus")![0][0]).toBeNull();
    // Wait out the zoom-out animation.
    await new Promise((r) => setTimeout(r, 550));
    expect(wrapper.find("g").attributes("transform")).toContain("scale(1)");
    // Activation is sticky — home doesn't dismiss the controls.
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows the double-click hint until the map is first zoomed", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { topology: statesTopo, width: 600, height: 400, zoom: true },
    });
    expect(wrapper.find(".choropleth-zoom-hint").text()).toBe(
      "Double click to zoom",
    );
    // Any first zoom (here a focus zoom) retires the hint for good.
    await wrapper.setProps({ focus: "06" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 550));
    await flushPromises();
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(false);
    wrapper.unmount();
  });

  it("renders no zoom hint when zoom is disabled", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400, zoom: false },
    });
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(false);
  });

  it("clicking a feature selects without activating pan/zoom", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400, zoom: true },
    });
    const root = wrapper.find(".choropleth-wrapper");
    await clickSelect(wrapper.find(".state-path"));
    await flushPromises();
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    // Only the first *zoom* switches the interaction on — a click doesn't.
    expect(root.classes()).not.toContain("pannable");
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(true);
  });

  it("renders no zoom hint when zoomHint is false", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        zoom: true,
        zoomHint: false,
      },
    });
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(false);
    // The controls are unaffected by the hint preference.
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(true);
  });

  it("controls are always present; + activates the interaction", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { topology: statesTopo, width: 600, height: 400, zoom: true },
    });
    // Visible from the start; − and home are no-ops at identity.
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(true);
    expect(
      wrapper.find('[aria-label="Zoom out"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.find('[aria-label="Reset view"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.find('[aria-label="Zoom in"]').trigger("click");
    await new Promise((r) => setTimeout(r, 550));
    await flushPromises();
    expect(wrapper.find("g").attributes("transform")).toContain("scale(2)");
    // Zoomed now — the interaction is live and −/home are enabled.
    expect(
      wrapper.find('[aria-label="Zoom out"]').attributes("disabled"),
    ).toBeUndefined();
    expect(
      wrapper.find('[aria-label="Reset view"]').attributes("disabled"),
    ).toBeUndefined();
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(false);
    wrapper.unmount();
  });

  it("never shows the controls when zoom is disabled", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { topology: statesTopo, width: 600, height: 400, zoom: false },
    });
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(false);
    // Even a programmatic focus zoom doesn't surface them — a parent
    // driving `focus` owns its own way back.
    await wrapper.setProps({ focus: "06" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 550));
    await flushPromises();
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(false);
    wrapper.unmount();
  });

  it("wheel zoom works while fullscreen (page scroll is locked)", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { topology: statesTopo, width: 600, height: 400, zoom: true },
    });
    const expand = wrapper
      .findComponent(ChartMenu)
      .props("items")
      .find((i) => i.label === "Fullscreen");
    expand!.action();
    await wrapper.vm.$nextTick();
    const mapSvg = document.querySelector(".state-path")!.closest("svg")!;
    // happy-dom's SVGPoint lacks matrixTransform; drop createSVGPoint so
    // d3's pointer() falls back to getBoundingClientRect coordinates.
    (mapSvg as unknown as { createSVGPoint?: unknown }).createSVGPoint =
      undefined;
    mapSvg.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -120,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    const transform = mapSvg.querySelector("g")!.getAttribute("transform");
    const k = parseFloat(/scale\(([\d.]+)\)/.exec(transform ?? "")?.[1] ?? "1");
    expect(k).toBeGreaterThan(1);
    wrapper.unmount();
  });

  it("fullscreen keeps the hint hidden and restores it on exit", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { topology: statesTopo, width: 600, height: 400, zoom: true },
    });
    const expand = wrapper
      .findComponent(ChartMenu)
      .props("items")
      .find((i) => i.label === "Fullscreen");
    expand!.action();
    await wrapper.vm.$nextTick();
    expect(document.querySelector(".chart-zoom-controls")).not.toBeNull();
    expect(document.querySelector(".choropleth-zoom-hint")).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(document.querySelector(".choropleth-zoom-hint")).not.toBeNull();
    wrapper.unmount();
  });

  it("+ and − buttons step the zoom scale", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        zoom: true,
        focus: "06",
        focusZoomLevel: 4,
      },
    });
    await flushPromises();
    await wrapper.find('[aria-label="Zoom out"]').trigger("click");
    await new Promise((r) => setTimeout(r, 550));
    expect(wrapper.find("g").attributes("transform")).toContain("scale(2)");
    await wrapper.find('[aria-label="Zoom in"]').trigger("click");
    await new Promise((r) => setTimeout(r, 550));
    expect(wrapper.find("g").attributes("transform")).toContain("scale(4)");
    wrapper.unmount();
  });
});
