import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { isTouchDevice } from "../_shared/touch.js";
import ChoroplethMap from "./ChoroplethMap.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import {
  autoUnmount,
  statesTopo,
  countiesTopo,
  dispatchTouch,
  strokeStyle,
} from "./ChoroplethMap.testUtils.js";

// Touch detection is probed per event, so tests can flip devices per case.
// happy-dom defaults to a mouse-only environment.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

describe("ChoroplethMap touch zoom", () => {
  afterEach(() => {
    vi.mocked(isTouchDevice).mockReturnValue(false);
  });

  function mountTouch(extraProps: Record<string, unknown> = {}) {
    vi.mocked(isTouchDevice).mockReturnValue(true);
    return mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        zoom: true,
        ...extraProps,
      },
    });
  }

  function tap(el: Element, x = 100, y = 100) {
    dispatchTouch(el, "touchstart", [{ clientX: x, clientY: y }]);
    dispatchTouch(el, "touchend", [{ clientX: x, clientY: y }]);
  }

  // Two immediate taps land well inside the double-tap window.
  function doubleTap(el: Element, x = 100, y = 100) {
    tap(el, x, y);
    tap(el, x, y);
  }

  // Wait out the deferred single-tap selection window.
  const settleTapSelect = () => new Promise((r) => setTimeout(r, 300));

  // Query through document — the map teleports to body while expanded, and
  // after a teleport round-trip VTU's wrapper loses track of the subtree.
  const mapSvg = () => document.querySelector(".state-path")!.closest("svg")!;
  const mapTransform = () =>
    mapSvg().querySelector("g")!.getAttribute("transform");

  it("expands to fill the window on a double tap without selecting", async () => {
    const wrapper = mountTouch({ menu: false });
    // Inline touch map advertises the zoom gesture...
    expect(wrapper.find(".choropleth-zoom-hint").text()).toBe(
      "Double tap to zoom",
    );
    // ...suppresses the browser's own double-tap zoom, and carries its
    // compositor layer up front so tap highlights repaint fast (WebKit).
    expect(mapSvg().getAttribute("style") ?? "").toContain("manipulation");
    expect(mapSvg().getAttribute("style") ?? "").toContain(
      "will-change: transform",
    );
    doubleTap(wrapper.find(".state-path").element);
    await flushPromises();
    // The hint retires while expanded.
    expect(document.querySelector(".choropleth-zoom-hint")).toBeNull();
    const root = document.querySelector<HTMLElement>(".choropleth-wrapper");
    expect(root?.classList.contains("is-fullscreen")).toBe(true);
    // Edge-to-edge on touch — no modal padding framing page content.
    expect(root?.style.padding).toBe("0px");
    // The first tap's deferred selection was cancelled by the second.
    await settleTapSelect();
    expect(wrapper.emitted("stateClick")).toBeUndefined();
    // Controls + the ✕ close button appear even with the menu disabled.
    expect(document.querySelector(".chart-zoom-controls")).not.toBeNull();
    expect(document.querySelector(".chart-close-button")).not.toBeNull();
    // Touch gestures belong to the map while expanded.
    expect(mapSvg().getAttribute("style") ?? "").toContain("none");
    wrapper.unmount();
  });

  it("a single tap selects inline instead of expanding", async () => {
    const wrapper = mountTouch();
    tap(wrapper.find(".state-path").element);
    await flushPromises();
    expect(
      document.querySelector(".choropleth-wrapper.is-fullscreen"),
    ).toBeNull();
    // Selection defers by the double-tap window, then fires.
    expect(wrapper.emitted("stateClick")).toBeUndefined();
    await settleTapSelect();
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    expect(
      document.querySelector(".choropleth-wrapper.is-fullscreen"),
    ).toBeNull();
    wrapper.unmount();
  });

  it("a tap acts as hover: highlight, stateHover, and tooltip", async () => {
    const wrapper = mountTouch({
      tooltipTrigger: "hover",
      data: [{ id: "06", value: 42 }],
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    tap(california.element);
    await flushPromises();
    // Hover-style highlight and tooltip respond instantly...
    expect(strokeStyle(california)).toContain("choropleth-highlight");
    expect(wrapper.emitted("stateHover")?.[0]?.[0]).toMatchObject({
      id: "06",
      value: 42,
    });
    const tip = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    expect(tip.style.visibility).toBe("visible");
    expect(tip.textContent).toContain("California");
    // Stacks above the fullscreen overlay (both are teleported to body).
    expect(tip.style.zIndex).toContain("--cfasim-z-fullscreen");
    // ...while the selection emit waits out the double-tap window.
    expect(wrapper.emitted("stateClick")).toBeUndefined();
    await settleTapSelect();
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    // A background tap dismisses the tap-hover state.
    tap(mapSvg(), 5, 5);
    await flushPromises();
    expect(tip.style.visibility).toBe("hidden");
    expect(wrapper.emitted("stateHover")?.at(-1)?.[0]).toBeNull();
    wrapper.unmount();
  });

  it("shows tooltips as a bottom sheet in the expanded view", async () => {
    const wrapper = mountTouch({
      tooltipTrigger: "hover",
      data: [{ id: "06", value: 42 }],
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    doubleTap(california.element);
    await flushPromises();
    // Wait out the enter animation (its zoom frames clear the hover state).
    await new Promise((r) => setTimeout(r, 550));
    tap(california.element);
    await flushPromises();
    const sheet = document.querySelector<HTMLElement>(".chart-tooltip-sheet")!;
    expect(sheet.classList.contains("is-open")).toBe(true);
    expect(sheet.textContent).toContain("California");
    // The floating tooltip stays dormant in sheet mode.
    const float = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    expect(float.style.visibility).toBe("hidden");
    // A background tap slides the sheet away.
    tap(mapSvg(), 5, 5);
    await flushPromises();
    expect(sheet.classList.contains("is-open")).toBe(false);
    // Leaving the expanded view drops sheet mode entirely.
    document.querySelector<HTMLElement>(".chart-close-button")!.click();
    await flushPromises();
    expect(document.querySelector(".chart-tooltip-sheet")).toBeNull();
    wrapper.unmount();
  });

  it("taps select features once expanded, and closing resets the zoom", async () => {
    const wrapper = mountTouch();
    const el = wrapper.find(".state-path").element;
    doubleTap(el);
    await flushPromises();
    // Wait out the enter animation so a transform is definitely applied.
    await new Promise((r) => setTimeout(r, 550));
    // Inside the expanded view taps select directly, no deferral.
    tap(el);
    await flushPromises();
    expect(wrapper.emitted("stateClick")).toHaveLength(1);

    const close = document.querySelector<HTMLElement>(".chart-close-button")!;
    close.click();
    await flushPromises();
    const root = document.querySelector(".choropleth-wrapper");
    expect(root?.classList.contains("is-fullscreen")).toBe(false);
    // Back to the static inline map at full extent.
    expect(mapTransform()).toContain("scale(1)");
    // Inline touch map shows no controls.
    expect(document.querySelector(".chart-zoom-controls")).toBeNull();
    wrapper.unmount();
  });

  it("locks the page pinch-zoom while expanded and restores it on close", async () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    meta.setAttribute("content", "width=device-width, initial-scale=1");
    document.head.appendChild(meta);
    try {
      const wrapper = mountTouch();
      doubleTap(wrapper.find(".state-path").element);
      await flushPromises();
      // Entering snaps the visual viewport back to 1× and holds it there.
      expect(meta.getAttribute("content")).toContain("maximum-scale=1");
      document.querySelector<HTMLElement>(".chart-close-button")!.click();
      await flushPromises();
      expect(meta.getAttribute("content")).toBe(
        "width=device-width, initial-scale=1",
      );
      wrapper.unmount();
    } finally {
      meta.remove();
    }
  });

  it("pins the expanded view to the visual viewport when pinch-zoomed", async () => {
    const listeners: Record<string, () => void> = {};
    const vv = {
      scale: 2,
      offsetTop: 120,
      offsetLeft: 40,
      width: 195,
      height: 422,
      addEventListener: (t: string, cb: () => void) => {
        listeners[t] = cb;
      },
      removeEventListener: () => {},
    };
    Object.defineProperty(window, "visualViewport", {
      value: vv,
      configurable: true,
    });
    try {
      const wrapper = mountTouch();
      doubleTap(wrapper.find(".state-path").element);
      await flushPromises();
      const root = document.querySelector<HTMLElement>(
        ".choropleth-wrapper.is-fullscreen",
      )!;
      // Fills exactly the visible box, not the (larger) layout viewport.
      expect(root.style.top).toBe("120px");
      expect(root.style.left).toBe("40px");
      expect(root.style.width).toBe("195px");
      expect(root.style.height).toBe("422px");
      // Once the page returns to 1×, the overlay re-expands with it.
      vv.scale = 1;
      vv.offsetTop = 0;
      vv.offsetLeft = 0;
      vv.width = 390;
      vv.height = 844;
      listeners.resize?.();
      await flushPromises();
      expect(root.style.top).toBe("0px");
      expect(root.style.width).toBe("390px");
      expect(root.style.height).toBe("844px");
      wrapper.unmount();
    } finally {
      Object.defineProperty(window, "visualViewport", {
        value: undefined,
        configurable: true,
      });
    }
  });

  it("touchExpand=false: double tap zooms in place, single tap selects", async () => {
    const wrapper = mountTouch({ touchExpand: false });
    // Inline controls + hint present; a single finger still scrolls the
    // page, but browser pinch/double-tap zoom is claimed for the map.
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(true);
    expect(wrapper.find(".choropleth-zoom-hint").text()).toBe(
      "Double tap to zoom",
    );
    expect(mapSvg().getAttribute("style") ?? "").toContain("pan-x pan-y");
    const el = wrapper.find(".state-path").element;
    // A single tap only selects (deferred by the double-tap window).
    tap(el);
    await settleTapSelect();
    await flushPromises();
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    expect(mapTransform()).toBeNull();
    // A double tap is the zoom gesture: in place, no fullscreen.
    doubleTap(el);
    await flushPromises();
    expect(
      document.querySelector(".choropleth-wrapper.is-fullscreen"),
    ).toBeNull();
    await new Promise((r) => setTimeout(r, 550));
    await flushPromises();
    expect(mapTransform()).toContain("scale(2)");
    // No further selection fired, and the map now owns touch gestures.
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    expect(mapSvg().getAttribute("style") ?? "").toContain("none");
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(false);
    wrapper.unmount();
  });

  it("touchExpand=false: reset restores the pre-zoom mode", async () => {
    const wrapper = mountTouch({ touchExpand: false });
    doubleTap(wrapper.find(".state-path").element);
    await new Promise((r) => setTimeout(r, 550));
    await flushPromises();
    expect(mapTransform()).toContain("scale(2)");
    await wrapper.find('[aria-label="Reset view"]').trigger("click");
    await new Promise((r) => setTimeout(r, 550));
    await flushPromises();
    expect(mapTransform()).toContain("scale(1)");
    // Pre-zoom mode restored: one-finger gestures released, hint back.
    expect(mapSvg().getAttribute("style") ?? "").toContain("pan-x pan-y");
    expect(wrapper.find(".choropleth-zoom-hint").exists()).toBe(true);
    wrapper.unmount();
  });

  it("scroll mode taps select inline — no expand step", async () => {
    const wrapper = mountTouch({ zoomMode: "scroll" });
    // The inline map is the interactive surface: controls present, touch
    // gestures claimed by the map.
    expect(wrapper.find(".chart-zoom-controls").exists()).toBe(true);
    expect(mapSvg().getAttribute("style") ?? "").toContain("touch-action");
    tap(wrapper.find(".state-path").element);
    await flushPromises();
    const root = document.querySelector(".choropleth-wrapper");
    expect(root?.classList.contains("is-fullscreen")).toBe(false);
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    wrapper.unmount();
  });

  it("does not expand on tap when zoom is disabled (tap selects inline)", async () => {
    const wrapper = mountTouch({ zoom: false });
    tap(wrapper.find(".state-path").element);
    await flushPromises();
    const root = document.querySelector(".choropleth-wrapper");
    expect(root?.classList.contains("is-fullscreen")).toBe(false);
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    wrapper.unmount();
  });
});

describe("ChoroplethMap canvas renderer", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let drawCtx: any;
  let pickCtx: any;
  let pickColor: number[];

  beforeEach(() => {
    pickColor = [0, 0, 0, 0];
    vi.stubGlobal(
      "Path2D",
      class {
        d?: string;
        constructor(d?: string) {
          this.d = d;
        }
      },
    );
    drawCtx = {
      canvas: { width: 0, height: 0 },
      lineWidth: 0,
      lineJoin: "",
      lineCap: "",
      fillStyle: "",
      strokeStyle: "",
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    };
    pickCtx = {
      canvas: { width: 0, height: 0 },
      imageSmoothingEnabled: true,
      fillStyle: "",
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      getImageData: vi.fn(() => ({ data: pickColor })),
      isPointInPath: vi.fn(() => true),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement, _type: string, opts?: unknown) {
        const ctx = (opts as { willReadFrequently?: boolean })
          ?.willReadFrequently
          ? pickCtx
          : drawCtx;
        ctx.canvas = this;
        return ctx;
      } as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mountCanvas = (extra: Record<string, unknown> = {}) =>
    mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        renderer: "canvas" as const,
        ...extra,
      },
    });

  // The interaction surface is the wrapper's direct-child svg (menu and
  // control icons are svgs too, nested deeper).
  const mapSurface = (wrapper: ReturnType<typeof mountCanvas>) =>
    wrapper.find(".choropleth-wrapper > svg");

  it("renders a canvas and no per-feature DOM, and draws the scene", async () => {
    const wrapper = mountCanvas();
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(true);
    expect(wrapper.findAll(".state-path").length).toBe(0);
    await new Promise((r) => setTimeout(r, 50));
    // One fill per feature (56 state geometries) on the first frame.
    expect(drawCtx.fill.mock.calls.length).toBeGreaterThanOrEqual(50);
    wrapper.unmount();
  });

  it("paints the theme background and exterior outline", async () => {
    // Capture paint styles at call time (the ctx properties mutate).
    const backgrounds: string[] = [];
    drawCtx.fillRect = vi.fn(() => backgrounds.push(drawCtx.fillStyle));
    const strokes: string[] = [];
    drawCtx.stroke = vi.fn(() => strokes.push(drawCtx.strokeStyle));
    const wrapper = mountCanvas({
      theme: { background: "#123", outline: "#0a0" },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(backgrounds).toContain("#123");
    expect(strokes).toContain("#0a0");
    wrapper.unmount();
  });

  it("clicks resolve through the picking canvas", async () => {
    const wrapper = mountCanvas({ zoom: false });
    await flushPromises();
    pickColor = [0, 0, 1, 255]; // feature index 0
    mapSurface(wrapper).element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 100, clientY: 100 }),
    );
    const click = wrapper.emitted("stateClick");
    expect(click).toHaveLength(1);
    expect((click![0][0] as { id: string }).id).toBeTruthy();
    wrapper.unmount();
  });

  it("hover picks per mousemove: highlight redraw + tooltip + stateHover", async () => {
    const wrapper = mountCanvas({
      zoom: false,
      tooltipTrigger: "hover",
      data: [{ id: "06", value: 42 }],
    });
    await new Promise((r) => setTimeout(r, 50));
    const fillsBefore = drawCtx.fill.mock.calls.length;
    pickColor = [0, 0, 1, 255];
    mapSurface(wrapper).element.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(wrapper.emitted("stateHover")).toHaveLength(1);
    // Highlight triggered a repaint.
    expect(drawCtx.fill.mock.calls.length).toBeGreaterThan(fillsBefore);
    const tip = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    expect(tip.style.visibility).toBe("visible");
    // Leaving the surface clears hover + tooltip.
    mapSurface(wrapper).element.dispatchEvent(
      new MouseEvent("mouseleave", { bubbles: false }),
    );
    await flushPromises();
    expect(tip.style.visibility).toBe("hidden");
    expect(wrapper.emitted("stateHover")?.at(-1)?.[0]).toBeNull();
    wrapper.unmount();
  });

  it("blits the cached base on a hover-only change instead of re-filling", async () => {
    // A hover transition changes only the 1-feature highlight, so it should
    // blit the cached base (drawImage) + draw one highlight — NOT re-fill all
    // 56 state geometries. Give the fake ctx a drawImage so the fast path (and
    // the offscreen snapshot capture) can engage.
    drawCtx.drawImage = vi.fn();
    const wrapper = mountCanvas({
      zoom: false,
      tooltipTrigger: "hover",
      data: [{ id: "06", value: 42 }],
    });
    await new Promise((r) => setTimeout(r, 50));
    const fillsBefore = drawCtx.fill.mock.calls.length;
    const blitsBefore = drawCtx.drawImage.mock.calls.length;
    pickColor = [0, 0, 1, 255];
    mapSurface(wrapper).element.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    // Blitted the base…
    expect(drawCtx.drawImage.mock.calls.length).toBeGreaterThan(blitsBefore);
    // …and only the single hover highlight re-filled (not the whole scene).
    expect(drawCtx.fill.mock.calls.length - fillsBefore).toBeLessThan(5);
    wrapper.unmount();
  });

  it("re-renders the full base (not a stale blit) when data changes", async () => {
    drawCtx.drawImage = vi.fn();
    const wrapper = mountCanvas({ data: [{ id: "06", value: 1 }] });
    await new Promise((r) => setTimeout(r, 50));
    const fillsBefore = drawCtx.fill.mock.calls.length;
    await wrapper.setProps({
      data: [
        { id: "06", value: 99 },
        { id: "48", value: 5 },
      ],
    });
    await new Promise((r) => setTimeout(r, 50));
    // markBaseDirty forced a full re-fill of every feature, not a 1-feature blit.
    expect(drawCtx.fill.mock.calls.length - fillsBefore).toBeGreaterThan(20);
    wrapper.unmount();
  });

  it("resizes the backing store when devicePixelRatio changes", async () => {
    const listeners: Array<() => void> = [];
    const queries: string[] = [];
    vi.spyOn(window, "matchMedia").mockImplementation((q: string) => {
      queries.push(q);
      return {
        matches: true,
        media: q,
        addEventListener: (_type: string, cb: () => void) => listeners.push(cb),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList;
    });
    Object.defineProperty(window, "devicePixelRatio", {
      value: 1,
      configurable: true,
    });
    try {
      const wrapper = mountCanvas();
      await flushPromises();
      expect(queries.at(-1)).toContain("1dppx");
      // happy-dom rects are zero — give the svg a concrete box.
      const svgEl = mapSurface(wrapper).element as SVGSVGElement;
      svgEl.getBoundingClientRect = () =>
        ({ width: 500, height: 312, top: 0, left: 0 }) as DOMRect;
      Object.defineProperty(window, "devicePixelRatio", {
        value: 2,
        configurable: true,
      });
      listeners.at(-1)!();
      const canvas = wrapper.find("canvas.choropleth-canvas")
        .element as HTMLCanvasElement;
      expect(canvas.width).toBe(1000);
      expect(canvas.height).toBe(624);
      // Re-armed against the new DPR.
      expect(queries.at(-1)).toContain("2dppx");
      wrapper.unmount();
    } finally {
      Object.defineProperty(window, "devicePixelRatio", {
        value: 1,
        configurable: true,
      });
    }
  });

  it("repaints synchronously on container resize (no blank frame)", async () => {
    // Resizing the backing store clears it. If the redraw were deferred to a
    // rAF, the just-cleared canvas would paint blank for a frame, so a
    // drag-resize flashes in and out. The resize handler must draw right away.
    const observers: { cb: ResizeObserverCallback; targets: Element[] }[] = [];
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
    const wrapper = mountCanvas();
    await new Promise((r) => setTimeout(r, 50));
    const svgEl = mapSurface(wrapper).element as SVGSVGElement;
    const canvas = wrapper.find("canvas.choropleth-canvas")
      .element as HTMLCanvasElement;
    const ro = observers.find((o) => o.targets.includes(svgEl))!;

    const fillsBefore = drawCtx.fill.mock.calls.length;
    ro.cb(
      [{ contentRect: { width: 500, height: 312 } } as ResizeObserverEntry],
      ro as unknown as ResizeObserver,
    );
    // Synchronous, with no rAF/flush: the backing store was resized AND the
    // scene repainted within the same tick.
    expect(canvas.width).toBe(500);
    expect(drawCtx.fill.mock.calls.length).toBeGreaterThan(fillsBefore);
    wrapper.unmount();
  });

  it("menu offers Fullscreen and Save as PNG only", () => {
    const wrapper = mountCanvas();
    const labels = wrapper
      .findComponent(ChartMenu)
      .props("items")
      .map((i) => i.label);
    expect(labels).toEqual(["Fullscreen", "Save as PNG"]);
    wrapper.unmount();
  });

  it("focus highlights and zooms without any path DOM", async () => {
    const wrapper = mountCanvas({ zoom: true });
    await flushPromises();
    const fillsBefore = drawCtx.fill.mock.calls.length;
    await wrapper.setProps({ focus: "06" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 550));
    // The zoom transform applied (controls report a zoomed state)...
    expect(
      wrapper.find('[aria-label="Reset view"]').attributes("disabled"),
    ).toBeUndefined();
    // ...and the focus repaint happened on canvas, not via DOM paths.
    expect(drawCtx.fill.mock.calls.length).toBeGreaterThan(fillsBefore);
    expect(wrapper.findAll(".state-path").length).toBe(0);
    wrapper.unmount();
  });

  it("switching renderer to canvas at runtime sizes the canvas, draws, and picks", async () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia");
    const wrapper = mountCanvas({ renderer: "svg" as const });
    await flushPromises();
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(50);
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(false);

    // The svg box doesn't change on a renderer flip, so the resize observer
    // won't fire — the component must size the fresh canvas itself from the
    // current box (happy-dom rects are zero; give the svg a concrete one).
    const svgEl = mapSurface(wrapper).element as SVGSVGElement;
    svgEl.getBoundingClientRect = () =>
      ({ width: 600, height: 400, top: 0, left: 0 }) as DOMRect;
    await wrapper.setProps({ renderer: "canvas" });
    await new Promise((r) => setTimeout(r, 50));

    // Path DOM replaced by a sized canvas (not the intrinsic 300×150)...
    expect(wrapper.findAll(".state-path").length).toBe(0);
    const canvas = wrapper.find("canvas.choropleth-canvas")
      .element as HTMLCanvasElement;
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(400);
    expect(canvas.style.width).toBe("600px");
    // ...the scene was drawn, the DPR listener armed, and picking re-wired.
    expect(drawCtx.fill.mock.calls.length).toBeGreaterThanOrEqual(50);
    expect(
      matchMediaSpy.mock.calls.some(([q]) => String(q).includes("dppx")),
    ).toBe(true);
    pickColor = [0, 0, 1, 255];
    mapSurface(wrapper).element.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(wrapper.emitted("stateHover")).toHaveLength(1);
    wrapper.unmount();
  });

  it("switching renderer back to svg rebuilds the path tree and delegation", async () => {
    const wrapper = mountCanvas();
    await flushPromises();
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(true);
    expect(wrapper.findAll(".state-path").length).toBe(0);

    await wrapper.setProps({ renderer: "svg" });
    await new Promise((r) => setTimeout(r, 50));
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(false);
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(50);
    // Canvas mode never writes the zoom transform into the svg group — the
    // flip syncs it (identity here, since nothing zoomed).
    expect(mapSurface(wrapper).find("g").attributes("transform")).toBe(
      "translate(0,0) scale(1)",
    );

    // Per-feature delegation works again...
    const path = wrapper.find(".state-path");
    path.element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(wrapper.emitted("stateHover")).toHaveLength(1);
    // ...and the canvas picking listener on the svg is gone.
    pickColor = [0, 0, 1, 255];
    mapSurface(wrapper).element.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(wrapper.emitted("stateHover")).toHaveLength(1);
    wrapper.unmount();
  });

  it("flips renderer and geoType together in one update", async () => {
    // Both change in the same tick: the geometry watcher rebuilds pre-flush
    // and the renderer watcher redoes the backend setup post-flush — the
    // scene must land in a sized canvas, not the intrinsic 300×150 store.
    const wrapper = mountCanvas({
      topology: countiesTopo,
      geoType: "counties" as const,
    });
    await flushPromises();
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(true);

    await wrapper.setProps({ geoType: "states", renderer: "svg" });
    await new Promise((r) => setTimeout(r, 50));
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(false);
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(50);

    const svgEl = mapSurface(wrapper).element as SVGSVGElement;
    svgEl.getBoundingClientRect = () =>
      ({ width: 600, height: 400, top: 0, left: 0 }) as DOMRect;
    const fillsBefore = drawCtx.fill.mock.calls.length;
    await wrapper.setProps({ geoType: "counties", renderer: "canvas" });
    await new Promise((r) => setTimeout(r, 50));
    expect(wrapper.findAll(".state-path").length).toBe(0);
    const canvas = wrapper.find("canvas.choropleth-canvas")
      .element as HTMLCanvasElement;
    expect(canvas.width).toBe(600);
    // Every county filled into the sized canvas.
    expect(drawCtx.fill.mock.calls.length - fillsBefore).toBeGreaterThan(2000);
    wrapper.unmount();
  });
});
