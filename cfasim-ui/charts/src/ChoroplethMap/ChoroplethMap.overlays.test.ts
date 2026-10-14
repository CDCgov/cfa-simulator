import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { isTouchDevice } from "../_shared/touch.js";
import ChoroplethMap from "./ChoroplethMap.vue";
import {
  autoUnmount,
  statesTopo,
  countiesTopo,
  hsaTopo,
  flushDynamicImports,
  flushOverlayLayout,
  strokeStyle,
} from "./ChoroplethMap.testUtils.js";

// Touch detection is probed per event, so tests can flip devices per case.
// happy-dom defaults to a mouse-only environment.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

describe("ChoroplethMap city overlay", () => {
  // The overlay is painted in a requestAnimationFrame callback; let it run.
  const CITIES = [
    {
      name: "Austin",
      coordinates: [-97.75, 30.28] as [number, number],
      capital: true,
    },
    { name: "Houston", coordinates: [-95.36, 29.76] as [number, number] },
    { name: "New York", coordinates: [-74.0, 40.71] as [number, number] },
  ];

  function layerOf(wrapper: ReturnType<typeof mount>) {
    return wrapper.find(".choropleth-cities");
  }

  it("renders a dot per city (including capitals, no star)", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, cities: CITIES },
    });
    await flushOverlayLayout();
    const layer = layerOf(wrapper);
    expect(layer.exists()).toBe(true);
    const el = layer.element;
    // Capitals are plain dots now — every city is a dot, no <polygon> stars.
    expect(el.querySelectorAll(".choropleth-city-dot")).toHaveLength(3);
    expect(el.querySelectorAll("polygon")).toHaveLength(0);
  });

  it("labels cities, marks the capital, and includes its name", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, cities: CITIES },
    });
    await flushOverlayLayout();
    const el = layerOf(wrapper).element;
    const labels = [...el.querySelectorAll(".choropleth-city-label")].map(
      (n) => n.textContent,
    );
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels).toContain("Austin");
    // The capital's label carries the capital class (styling hook only).
    const capitalLabels = [
      ...el.querySelectorAll(".choropleth-city-label-capital"),
    ].map((n) => n.textContent);
    expect(capitalLabels).toContain("Austin");
  });

  it("renders nothing when cities is undefined", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500 },
    });
    expect(layerOf(wrapper).exists()).toBe(false);
  });

  it("applies marker theme keys: colors, halo width, and opacity", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        cities: CITIES,
        theme: {
          markerColor: "#123456",
          markerHalo: "#654321",
          markerHaloWidth: 2,
          markerOpacity: 0.5,
        },
      },
    });
    await flushOverlayLayout();
    const layer = layerOf(wrapper).element as SVGGElement;
    expect(layer.style.getPropertyValue("--choropleth-city-marker")).toBe(
      "#123456",
    );
    expect(layer.style.getPropertyValue("--choropleth-city-label-color")).toBe(
      "#123456",
    );
    expect(layer.style.getPropertyValue("--choropleth-city-halo")).toBe(
      "#654321",
    );
    expect(layer.style.opacity).toBe("0.5");
    // Halo width is written as a per-dot attribute (compensated by
    // viewScale, which is 1 here).
    const dot = layer.querySelector(".choropleth-city-dot")!;
    expect(dot.getAttribute("stroke-width")).toBe("2");
  });

  it("leaves marker styling to the CSS custom properties when unset", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        cities: CITIES,
        theme: { outline: "#0a0" },
      },
    });
    await flushOverlayLayout();
    const layer = layerOf(wrapper).element as SVGGElement;
    expect(layer.style.getPropertyValue("--choropleth-city-marker")).toBe("");
    expect(layer.style.opacity).toBe("");
  });

  it("adds markers reactively when cities is supplied later", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500 },
    });
    expect(layerOf(wrapper).exists()).toBe(false);
    await wrapper.setProps({ cities: CITIES });
    await flushOverlayLayout();
    expect(
      layerOf(wrapper).element.querySelectorAll(".choropleth-city-dot"),
    ).toHaveLength(3);
  });

  it("puts the city layer in its own overlay svg (so it paints above the canvas backend)", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, cities: CITIES },
    });
    await flushOverlayLayout();
    const overlay = wrapper.find(".choropleth-city-overlay");
    expect(overlay.exists()).toBe(true);
    expect(overlay.element.tagName.toLowerCase()).toBe("svg");
    expect(
      overlay.element.querySelectorAll(".choropleth-city-dot"),
    ).toHaveLength(3);
    // The city <g>'s nearest svg is the overlay, NOT the interaction/map svg —
    // that separation is what lets it sit above the opaque canvas backend
    // (which paints over the interaction svg). Verified visually for the
    // canvas renderer; happy-dom can't mount canvas mode (no Path2D).
    const g = overlay.element.querySelector(".choropleth-cities");
    expect(g?.closest("svg")).toBe(overlay.element);
  });

  it("pins the overlay svg's box in JS (so a title/legend header doesn't offset it)", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        cities: CITIES,
        title: "Cities",
      },
    });
    await flushOverlayLayout();
    const overlay = wrapper.find(".choropleth-city-overlay");
    expect(overlay.exists()).toBe(true);
    // renderCityLayer sets top/left/width/height inline to match the map svg's
    // box (which the in-flow header pushes down) — not the wrapper's top:0.
    const style = (overlay.element as SVGSVGElement).style;
    expect(style.width).not.toBe("");
    expect(style.height).not.toBe("");
    expect(style.top).not.toBe("");
    expect(style.left).not.toBe("");
  });

  it("hides cities on a zoomable map until zoomed past citiesMinZoom", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        cities: CITIES,
        zoom: true,
      },
    });
    await flushOverlayLayout();
    // At base zoom (k=1 < default citiesMinZoom of 2) nothing is drawn yet.
    expect(
      layerOf(wrapper).element.querySelectorAll(".choropleth-city-dot"),
    ).toHaveLength(0);
  });

  it("shows cities on a zoomable map when citiesMinZoom is 1", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        cities: CITIES,
        zoom: true,
        citiesMinZoom: 1,
      },
    });
    await flushOverlayLayout();
    expect(
      layerOf(wrapper).element.querySelectorAll(".choropleth-city-dot").length,
    ).toBeGreaterThan(0);
  });

  it("reveals cities by their own minZoom (level-of-detail)", async () => {
    const tiered = [
      {
        name: "Big",
        coordinates: [-74, 40.71] as [number, number],
        minZoom: 1,
      },
      {
        name: "Small",
        coordinates: [-118, 34] as [number, number],
        minZoom: 5,
      },
    ];
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        cities: tiered,
        zoom: true,
      },
    });
    await flushOverlayLayout();
    // At base zoom (k=1): the minZoom-1 city shows, the minZoom-5 one doesn't.
    const labels = [
      ...layerOf(wrapper).element.querySelectorAll(".choropleth-city-label"),
    ].map((n) => n.textContent);
    expect(
      layerOf(wrapper).element.querySelectorAll(".choropleth-city-dot"),
    ).toHaveLength(1);
    expect(labels).toContain("Big");
    expect(labels).not.toContain("Small");
  });
});

describe("ChoroplethMap theming", () => {
  const mapSvg = (wrapper: ReturnType<typeof mount>) =>
    wrapper.find(".choropleth-wrapper > svg");

  const bordersPath = (wrapper: ReturnType<typeof mount>) =>
    mapSvg(wrapper).find(".choropleth-state-borders");

  it("applies theme.stroke to feature paths", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        theme: { stroke: "#333" },
      },
    });
    for (const p of wrapper.findAll(".state-path")) {
      expect(p.attributes("stroke")).toBe("#333");
    }
  });

  it("uses per-stop strokes and highlights with theme fallbacks", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 40 },
          { id: "36", value: 80 },
        ],
        colorScale: [
          { min: 0, color: "#fff", stroke: "#ccc", highlight: "#555" },
          {
            min: 60,
            color: "#6d085a",
            stroke: "#fff",
            highlight: "#eee",
          },
        ],
        theme: { stroke: "#aaa", highlight: "#111" },
      },
    });
    const path = (id: string) =>
      wrapper.find(`.state-path[data-feat-id="${id}"]`);
    expect(path("06").attributes("stroke")).toBe("#ccc");
    expect(path("36").attributes("stroke")).toBe("#fff");
    expect(path("01").attributes("stroke")).toBe("#aaa");
    await path("06").trigger("mouseover");
    expect(strokeStyle(path("06"))).toBe("#555");
    await path("06").trigger("mouseout");

    await wrapper.setProps({
      data: [
        { id: "06", value: 80 },
        { id: "36", value: 80 },
      ],
    });
    expect(path("06").attributes("stroke")).toBe("#fff");
    await path("06").trigger("mouseover");
    expect(strokeStyle(path("06"))).toBe("#eee");
  });

  it("defaults feature strokes to the light constant in test DOMs", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    expect(wrapper.find(".state-path").attributes("stroke")).toBe("#fff");
  });

  it("does not repaint every feature again once the probe mounts", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
      },
    });
    // The theme resolver attaches its probe on mount. Where that changes
    // nothing (a DOM without computed styles), the fill/stroke watchers
    // must stay put — on a county map a spurious repaint is ~3k attribute
    // writes per mount.
    const spy = vi.spyOn(wrapper.find(".state-path").element, "setAttribute");
    await flushPromises();
    expect(spy).not.toHaveBeenCalled();
  });

  it("restyles only the highlighted paths when theme.highlight changes", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        theme: { highlight: "#111" },
      },
    });
    // `resolvedTheme` invalidates as a whole, so without a per-value guard
    // a highlight tweak repaints every feature's fill and stroke — ~6k
    // wasted attribute writes on a county map.
    const spy = vi.spyOn(wrapper.find(".state-path").element, "setAttribute");
    await wrapper.setProps({ theme: { highlight: "#222" } });
    expect(spy).not.toHaveBeenCalled();
  });

  it("borders mesh follows theme.stroke until theme.borders overrides", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        theme: { stroke: "#333" },
      },
    });
    expect(bordersPath(wrapper)!.attributes("stroke")).toBe("#333");
    await wrapper.setProps({ theme: { stroke: "#333", borders: "#900" } });
    expect(bordersPath(wrapper)!.attributes("stroke")).toBe("#900");
    expect(wrapper.find(".state-path").attributes("stroke")).toBe("#333");
  });

  it("renders the exterior outline when theme.outline is set", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        theme: { outline: "#0a0", outlineWidth: 2 },
      },
    });
    const outline = wrapper.find(".choropleth-outline");
    expect(outline.exists()).toBe(true);
    expect(outline.attributes("stroke")).toBe("#0a0");
    expect(outline.attributes("stroke-width")).toBe("2");
    expect(outline.attributes("fill")).toBe("none");
    expect(outline.attributes("pointer-events")).toBe("none");
    expect(outline.attributes("d")).toBeTruthy();
  });

  it("renders no exterior outline by default", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    expect(wrapper.find(".choropleth-outline").exists()).toBe(false);
  });

  it("removes the outline when the theme drops it", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        theme: { outline: "#0a0" },
      },
    });
    expect(wrapper.find(".choropleth-outline").exists()).toBe(true);
    await wrapper.setProps({ theme: {} });
    expect(wrapper.find(".choropleth-outline").exists()).toBe(false);
  });

  it("defers the HSA-map outline until the lazy module resolves", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        width: 600,
        height: 400,
        theme: { outline: "#0a0" },
      },
    });
    // Pre-module: no features, so no outline path (a NaN-fitted projection
    // must not leak a "MNaN…" path).
    expect(wrapper.find(".choropleth-outline").exists()).toBe(false);
    await flushDynamicImports();
    const outline = wrapper.find(".choropleth-outline");
    expect(outline.exists()).toBe(true);
    expect(outline.attributes("d")).not.toContain("NaN");
  });

  it("scopes the outline to the selected state in single-state mode", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        state: "California",
        width: 600,
        height: 400,
        theme: { outline: "#0a0" },
      },
    });
    const outline = wrapper.find(".choropleth-outline");
    expect(outline.exists()).toBe(true);
    expect(outline.attributes("d")).toBeTruthy();
  });

  it("paints a background rect when theme.background is set", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        theme: { background: "#123" },
      },
    });
    const rect = wrapper.find("rect.choropleth-map-background");
    expect(rect.exists()).toBe(true);
    expect(rect.attributes("fill")).toBe("#123");
    await wrapper.setProps({ theme: {} });
    expect(wrapper.find("rect.choropleth-map-background").exists()).toBe(false);
  });

  it("theme.strokeWidth applies as-is on county maps", () => {
    const explicit = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        theme: { strokeWidth: 2 },
      },
    });
    // svg > mapGroup > [baseGroup, overlayGroup]
    expect(mapSvg(explicit).findAll("g")[1].attributes("stroke-width")).toBe(
      "2",
    );
    const dflt = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
      },
    });
    expect(mapSvg(dflt).findAll("g")[1].attributes("stroke-width")).toBe(
      "0.25",
    );
  });

  it("lowers a hover-raised path back below the exterior outline", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        theme: { outline: "#0a0" },
      },
    });
    const baseG = mapSvg(wrapper).findAll("g")[1].element;
    expect(
      baseG.lastElementChild?.classList.contains("choropleth-outline"),
    ).toBe(true);
    const path = wrapper.find(".state-path");
    await path.trigger("mouseover");
    // Raised above the outline while highlighted...
    expect(baseG.lastElementChild).toBe(path.element);
    await path.trigger("mouseout");
    // ...and lowered back below it on un-hover, so the outline isn't left
    // occluded along this feature's edges.
    expect(
      baseG.lastElementChild?.classList.contains("choropleth-outline"),
    ).toBe(true);
  });

  it("hover highlight uses theme.highlight", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        theme: { highlight: "#f0f" },
      },
    });
    const path = wrapper.find(".state-path");
    await path.trigger("mouseover");
    expect(strokeStyle(path)).toBe("#f0f");
  });

  it("repaints fills when theme.fill changes", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    expect(wrapper.find(".state-path").attributes("fill")).toBe("#ddd");
    await wrapper.setProps({ theme: { fill: "#eee" } });
    expect(wrapper.find(".state-path").attributes("fill")).toBe("#eee");
  });
});

describe("ChoroplethMap enlargeDc", () => {
  // Rough bbox of a path's `d` (geoPath emits only M/L pairs for polygons).
  function pathBBox(d: string) {
    const nums = d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)!.map(Number);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = nums[i];
      const y = nums[i + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  function dOf(wrapper: ReturnType<typeof mount>, id: string) {
    return wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === id)!
      .attributes("d")!;
  }

  it("is on by default for state maps, off for county maps, false disables", () => {
    const auto = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500 },
    });
    const off = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        enlargeDc: false,
      },
    });
    const ratio = pathBBox(dOf(auto, "11")).w / pathBBox(dOf(off, "11")).w;
    expect(ratio).toBeGreaterThan(3.4);
    expect(ratio).toBeLessThan(4.6);
    // County maps stay opt-in.
    const countyAuto = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 800,
        height: 500,
      },
    });
    const countyOff = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 800,
        height: 500,
        enlargeDc: false,
      },
    });
    expect(dOf(countyAuto, "11001")).toBe(dOf(countyOff, "11001"));
  });

  it("enlarges DC in place at the overview (true → 4×), neighbors untouched", () => {
    const plain = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        enlargeDc: false,
      },
    });
    const scaled = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, enlargeDc: true },
    });
    const before = pathBBox(dOf(plain, "11"));
    const after = pathBBox(dOf(scaled, "11"));
    expect(after.w / before.w).toBeGreaterThan(3.4);
    expect(after.w / before.w).toBeLessThan(4.6);
    expect(after.h / before.h).toBeGreaterThan(3.4);
    expect(after.h / before.h).toBeLessThan(4.6);
    // In place: the center barely moves.
    expect(Math.abs(after.cx - before.cx)).toBeLessThan(3);
    expect(Math.abs(after.cy - before.cy)).toBeLessThan(3);
    // Maryland untouched.
    expect(dOf(scaled, "24")).toBe(dOf(plain, "24"));
    // DC paints last so the enlargement sits above its neighbors.
    const paths = scaled.findAll(".state-path");
    expect(paths[paths.length - 1].attributes("data-feat-id")).toBe("11");
  });

  it("accepts a numeric factor and ignores factors ≤ 1", () => {
    const plain = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        enlargeDc: false,
      },
    });
    const five = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, enlargeDc: 5 },
    });
    const ratio = pathBBox(dOf(five, "11")).w / pathBBox(dOf(plain, "11")).w;
    expect(ratio).toBeGreaterThan(4.3);
    expect(ratio).toBeLessThan(5.7);
    const noop = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, enlargeDc: 1 },
    });
    expect(dOf(noop, "11")).toBe(dOf(plain, "11"));
  });

  it("shrinks back to true size once the zoom catches up", async () => {
    const plain = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        enlargeDc: false,
      },
    });
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        zoom: true,
        enlargeDc: 2,
      },
    });
    expect(dOf(wrapper, "11")).not.toBe(dOf(plain, "11"));
    // A focus zoom animates to k = focusZoomLevel (4): the effective scale
    // max(1, 2/4) bottoms out at 1 and DC returns to its exact base
    // geometry. The path `d` is in canonical coordinates (the zoom lives on
    // the group transform), so base and zoomed `d`s compare directly.
    await wrapper.setProps({ focus: "24" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 550));
    await flushPromises();
    expect(dOf(wrapper, "11")).toBe(dOf(plain, "11"));
    wrapper.unmount();
  });

  it("enlarges DC's county on a county map", () => {
    const plain = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 800,
        height: 500,
      },
    });
    const scaled = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 800,
        height: 500,
        enlargeDc: 6,
      },
    });
    const before = pathBBox(dOf(plain, "11001"));
    const after = pathBBox(dOf(scaled, "11001"));
    expect(after.w / before.w).toBeGreaterThan(5);
    expect(after.w / before.w).toBeLessThan(7);
  });

  it("enlarges DC's HSA on an HSA map", async () => {
    const { fipsToHsa } = await import("./hsaMapping.js");
    const dcHsa = fipsToHsa["11001"];
    expect(dcHsa).toBeTruthy();
    const plain = mount(ChoroplethMap, {
      props: {
        topology: hsaTopo,
        geoType: "hsas" as const,
        width: 800,
        height: 500,
      },
    });
    const scaled = mount(ChoroplethMap, {
      props: {
        topology: hsaTopo,
        geoType: "hsas" as const,
        width: 800,
        height: 500,
        enlargeDc: 4,
      },
    });
    await flushDynamicImports();
    const before = pathBBox(dOf(plain, dcHsa));
    const after = pathBBox(dOf(scaled, dcHsa));
    expect(after.w / before.w).toBeGreaterThan(3.2);
    expect(after.w / before.w).toBeLessThan(4.8);
  });

  it("keeps the enlargement above a neighbor after a hover cycle", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, enlargeDc: true },
    });
    const lastId = () => {
      const paths = wrapper.findAll(".state-path");
      return paths[paths.length - 1].attributes("data-feat-id");
    };
    const md = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "24")!;
    await md.trigger("mouseover");
    // While hovered the neighbor wins, matching the canvas highlight.
    expect(lastId()).toBe("24");
    await md.trigger("mouseout");
    expect(lastId()).toBe("11");
  });

  it("does nothing in single-state mode", () => {
    const plain = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        state: "11",
        width: 800,
        height: 500,
      },
    });
    const scaled = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        state: "11",
        width: 800,
        height: 500,
        enlargeDc: true,
      },
    });
    expect(dOf(scaled, "11001")).toBe(dOf(plain, "11001"));
  });
});

describe("ChoroplethMap state labels (stateLabels)", () => {
  function layerOf(wrapper: ReturnType<typeof mount>) {
    return wrapper.find(".choropleth-state-labels");
  }

  function labelFor(wrapper: ReturnType<typeof mount>, abbr: string) {
    return [
      ...layerOf(wrapper).element.querySelectorAll(".choropleth-state-label"),
    ].find((n) => n.textContent === abbr) as SVGTextElement | undefined;
  }

  it("renders nothing by default", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500 },
    });
    expect(layerOf(wrapper).exists()).toBe(false);
  });

  it("labels every projectable state with its USPS abbreviation", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500 },
    });
    await wrapper.setProps({ stateLabels: true });
    await flushOverlayLayout();
    const labels = [
      ...layerOf(wrapper).element.querySelectorAll(".choropleth-state-label"),
    ].map((n) => n.textContent);
    // 50 states + DC; the island territories project to null under
    // geoAlbersUsa and are skipped.
    expect(labels.length).toBeGreaterThanOrEqual(50);
    expect(labels).toContain("CA");
    expect(labels).toContain("TX");
    expect(labels).toContain("RI");
    // No duplicates.
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("gives small east-coast states callout labels with leader lines", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        stateLabels: true,
      },
    });
    await flushOverlayLayout();
    const el = layerOf(wrapper).element;
    for (const abbr of ["RI", "DE", "DC"]) {
      const label = labelFor(wrapper, abbr)!;
      expect(label, abbr).toBeDefined();
      expect(label.getAttribute("class")).toContain(
        "choropleth-state-label-callout",
      );
    }
    // Big states are labeled in place, no leader.
    for (const abbr of ["CA", "TX"]) {
      const label = labelFor(wrapper, abbr)!;
      expect(label.getAttribute("class")).toContain(
        "choropleth-state-label-inside",
      );
    }
    // Leaders only for displaced callouts: DC's label is pushed across
    // Maryland to open water, so it gets a line; Hawaii's label sits right
    // beside the big island, so it doesn't. Never more lines than callouts.
    const callouts = el.querySelectorAll(".choropleth-state-label-callout");
    const leaders = el.querySelectorAll(".choropleth-state-leader");
    expect(leaders.length).toBeGreaterThan(0);
    expect(leaders.length).toBeLessThanOrEqual(callouts.length);
    expect(
      el.querySelector('.choropleth-state-leader[data-state="11"]'),
    ).not.toBeNull();
    expect(
      el.querySelector('.choropleth-state-leader[data-state="15"]'),
    ).toBeNull();
    expect(labelFor(wrapper, "HI")).toBeDefined();
  });

  it("picks light text on dark fills and dark text on light fills", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        stateLabels: true,
        colorScale: { min: "#ffffff", max: "#000000" },
        data: [
          { id: "06", value: 100 }, // California → max → black fill
          { id: "36", value: 0 }, // New York → min → white fill
        ],
      },
    });
    await flushOverlayLayout();
    const ca = labelFor(wrapper, "CA")!;
    const ny = labelFor(wrapper, "NY")!;
    expect(ca.style.fill).toContain("--choropleth-state-label-light");
    expect(ny.style.fill).toContain("--choropleth-state-label-dark");
    // Contrast-picked labels drop the halo (it would blur against the fill).
    expect(ca.getAttribute("class")).not.toContain(
      "choropleth-state-label-halo",
    );
  });

  it("keeps the halo default on county maps (no uniform state fill)", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 800,
        height: 500,
        stateLabels: true,
      },
    });
    await flushOverlayLayout();
    const ca = labelFor(wrapper, "CA")!;
    expect(ca).toBeDefined();
    expect(ca.getAttribute("class")).toContain("choropleth-state-label-halo");
    expect(ca.style.fill).toBe("");
    expect(Number(ca.getAttribute("stroke-width"))).toBeGreaterThan(0);
  });

  it("labels only the scoped state in single-state mode", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        state: "California",
        width: 800,
        height: 500,
        stateLabels: true,
      },
    });
    await flushOverlayLayout();
    const labels = [
      ...layerOf(wrapper).element.querySelectorAll(".choropleth-state-label"),
    ].map((n) => n.textContent);
    expect(labels).toEqual(["CA"]);
  });

  it("makes label boxes hover/click proxies when a tooltip is configured", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        stateLabels: true,
        tooltipTrigger: "hover" as const,
        data: [{ id: "44", value: 7 }],
      },
    });
    await flushOverlayLayout();
    const hit = layerOf(wrapper).element.querySelector(
      '.choropleth-state-label-hit[data-feat-id="44"]',
    )!;
    expect(hit).not.toBeNull();

    // Hovering Rhode Island's callout label box shows its tooltip, emits
    // stateHover, and highlights the state path itself.
    hit.dispatchEvent(
      new MouseEvent("mouseover", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    const tip = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    expect(tip.style.visibility).toBe("visible");
    // Slot content lands on the next Vue patch.
    await flushPromises();
    expect(tip.textContent).toContain("Rhode Island");
    const hovers = wrapper.emitted("stateHover")!;
    expect(hovers.at(-1)![0]).toMatchObject({ id: "44" });
    const ri = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "44")!;
    expect((ri.element as SVGPathElement).style.stroke).not.toBe("");

    // Leaving the label box clears hover + tooltip.
    hit.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    expect(tip.style.visibility).toBe("hidden");
    expect(wrapper.emitted("stateHover")!.at(-1)![0]).toBeNull();

    // Clicking the label box selects the state like clicking the state.
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(wrapper.emitted("stateClick")!.at(-1)![0]).toMatchObject({
      id: "44",
    });
    wrapper.unmount();
  });

  it("hover-highlights from a label box even without a tooltip", async () => {
    // Matches the map itself: hovering a state applies the highlight and
    // emits stateHover with no tooltip configured; labels proxy the same.
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        stateLabels: true,
      },
    });
    await flushOverlayLayout();
    const hit = layerOf(wrapper).element.querySelector(
      '.choropleth-state-label-hit[data-feat-id="44"]',
    )!;
    expect(hit).not.toBeNull();
    hit.dispatchEvent(
      new MouseEvent("mouseover", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(wrapper.emitted("stateHover")!.at(-1)![0]).toMatchObject({
      id: "44",
    });
    const ri = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "44")!;
    expect((ri.element as SVGPathElement).style.stroke).not.toBe("");
    // No tooltip configured → none shown.
    expect(document.body.querySelector(".chart-tooltip-content")).toBeNull();
    wrapper.unmount();
  });

  it("keeps label boxes inert on county maps and on touch devices", async () => {
    // County map: the state isn't rendered as one states-level feature, so
    // there's nothing to proxy hover to.
    const counties = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 800,
        height: 500,
        stateLabels: true,
        tooltipTrigger: "hover" as const,
      },
    });
    await flushOverlayLayout();
    expect(
      layerOf(counties).element.querySelectorAll(".choropleth-state-label-hit"),
    ).toHaveLength(0);

    // Touch device: the overlay must stay transparent so taps keep feeding
    // the map's own gesture handling.
    vi.mocked(isTouchDevice).mockReturnValue(true);
    try {
      const touch = mount(ChoroplethMap, {
        props: {
          topology: statesTopo,
          width: 800,
          height: 500,
          stateLabels: true,
          tooltipTrigger: "hover" as const,
        },
      });
      await flushOverlayLayout();
      expect(
        layerOf(touch).element.querySelectorAll(".choropleth-state-label-hit")
          .length,
      ).toBe(0);
      expect(
        layerOf(touch).element.querySelectorAll(".choropleth-state-label")
          .length,
      ).toBeGreaterThan(0);
    } finally {
      vi.mocked(isTouchDevice).mockReturnValue(false);
    }
  });

  it("reserves a right margin in the projection fit for the coast column", async () => {
    // With stateLabels on, the national fit shrinks slightly to the left so
    // the east-coast callout column has room beside its states; Maine's
    // path must therefore differ from the flush default fit.
    const meD = (w: ReturnType<typeof mount>) =>
      (
        w
          .findAll(".state-path")
          .find((p) => p.attributes("data-feat-id") === "23")!
          .element as SVGPathElement
      ).getAttribute("d");
    const plain = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500 },
    });
    const labeled = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        stateLabels: true,
      },
    });
    await flushOverlayLayout();
    expect(meD(labeled)).not.toBe(meD(plain));
  });

  it("clears the layer when stateLabels is switched off", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        stateLabels: true,
      },
    });
    await flushOverlayLayout();
    expect(
      layerOf(wrapper).element.querySelectorAll(".choropleth-state-label")
        .length,
    ).toBeGreaterThan(0);
    await wrapper.setProps({ stateLabels: false });
    await flushOverlayLayout();
    expect(layerOf(wrapper).exists()).toBe(false);
  });
});
