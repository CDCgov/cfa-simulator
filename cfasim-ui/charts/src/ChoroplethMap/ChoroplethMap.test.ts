import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { isTouchDevice } from "../_shared/touch.js";

// Touch detection is probed per event, so tests can flip devices per case.
// jsdom defaults to a mouse-only environment.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

// HSA mapping is dynamic-imported inside ChoroplethMap to keep the main
// bundle small. Tests that exercise hsas geoType or cross-geoType focus
// must await both the dynamic import and the Vue render that follows.
async function flushDynamicImports() {
  await vi.dynamicImportSettled();
  await flushPromises();
}
import ChoroplethMap from "./ChoroplethMap.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
import type { Topology } from "topojson-specification";

const statesTopo = usStates as unknown as Topology;
const countiesTopo = usCounties as unknown as Topology;

// jsdom has no TouchEvent; dispatch a plain bubbling event with the touch
// lists our handlers read off it. `el` is the path the touch lands on.
function dispatchTouch(
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

// Highlight color is applied as inline style (so the theme-following
// light-dark() default resolves); read it back off the raw element.
const strokeStyle = (w: { element: Element }) =>
  (w.element as SVGPathElement).style.stroke;

// Click-select defers by a double-click-sized window so a double-click can
// zoom instead of selecting; run a click and flush past that window.
async function clickSelect(target: { trigger: (e: string) => Promise<void> }) {
  vi.useFakeTimers();
  try {
    await target.trigger("click");
    vi.advanceTimersByTime(300);
  } finally {
    vi.useRealTimers();
  }
}

describe("ChoroplethMap", () => {
  it("renders SVG with state paths", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
    const paths = wrapper.findAll(".state-path");
    // us-atlas states-10m has 56 geometries (50 states + DC + territories)
    expect(paths.length).toBeGreaterThanOrEqual(50);
  });

  it("renders without data (all states default gray)", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const paths = wrapper.findAll(".state-path");
    for (const path of paths) {
      expect(path.attributes("fill")).toBe("#ddd");
    }
  });

  it("colors states based on data by FIPS id", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 100 }, // California
          { id: "36", value: 0 }, // New York
        ],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    expect(california).toBeDefined();
    // California has max value so should get the max color
    expect(california!.attributes("fill")).not.toBe("#ddd");
  });

  it("colors states based on data by name", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "California", value: 50 }],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    expect(california).toBeDefined();
    expect(california!.attributes("fill")).not.toBe("#ddd");
  });

  it("renders title when provided", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        title: "US Cases",
      },
    });
    expect(wrapper.find(".choropleth-title").text()).toBe("US Cases");
  });

  it("applies custom color scale", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 0 },
          { id: "36", value: 100 },
        ],
        colorScale: { min: "#ffffff", max: "#ff0000" },
      },
    });
    const ny = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("New York"));
    expect(ny!.attributes("fill")).toBe("rgb(255,0,0)");
  });

  it("shows state name and value in tooltip title", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 42 }],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    expect(california!.find("title").text()).toContain("42");
  });

  it("formats numeric tooltip values via tooltipValueFormat", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 1234 }],
        tooltipValueFormat: (v: number) => `$${v.toLocaleString()}`,
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    const titleText = california!.find("title").text();
    expect(titleText).toContain("$1,234");
    expect(titleText).not.toMatch(/: 1234\b/);
  });

  it("applies threshold color scale", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 80 },
          { id: "36", value: 30 },
          { id: "48", value: 5 },
        ],
        colorScale: [
          { min: 0, color: "#green1" },
          { min: 10, color: "#yellow1" },
          { min: 50, color: "#red1" },
        ],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    const ny = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("New York"));
    const tx = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("Texas"));
    expect(california!.attributes("fill")).toBe("#red1");
    expect(ny!.attributes("fill")).toBe("#yellow1");
    expect(tx!.attributes("fill")).toBe("#green1");
  });

  it("threshold scale returns default gray when below all stops", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 5 }],
        colorScale: [{ min: 100, color: "#red" }],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    expect(california!.attributes("fill")).toBe("#ddd");
  });

  it("threshold stops can be provided in any order", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 50 },
          { id: "36", value: 5 },
        ],
        colorScale: [
          { min: 10, color: "#high" },
          { min: 0, color: "#low" },
        ],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    const ny = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("New York"));
    expect(california!.attributes("fill")).toBe("#high");
    expect(ny!.attributes("fill")).toBe("#low");
  });

  it("applies categorical color scale with string values", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: "high" },
          { id: "36", value: "low" },
          { id: "48", value: "medium" },
        ],
        colorScale: [
          { value: "low", color: "#green1" },
          { value: "medium", color: "#yellow1" },
          { value: "high", color: "#red1" },
        ],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    const ny = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("New York"));
    const tx = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("Texas"));
    expect(california!.attributes("fill")).toBe("#red1");
    expect(ny!.attributes("fill")).toBe("#green1");
    expect(tx!.attributes("fill")).toBe("#yellow1");
  });

  it("categorical scale returns noDataColor for unmatched values", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: "unknown" }],
        colorScale: [{ value: "high", color: "#red" }],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    expect(california!.attributes("fill")).toBe("#ddd");
  });

  it("categorical scale shows string value in tooltip", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: "high" }],
        colorScale: [{ value: "high", color: "#red" }],
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("California"));
    expect(california!.find("title").text()).toContain("high");
  });

  it("uses the theme's base fill for states without data", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        theme: { fill: "#eee" },
      },
    });
    const ny = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("New York"));
    expect(ny!.attributes("fill")).toBe("#eee");
  });

  it("emits stateClick on path click", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const firstPath = wrapper.find(".state-path");
    await clickSelect(firstPath);
    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    const payload = wrapper.emitted("stateClick")![0][0] as {
      id: string;
      name: string;
    };
    expect(payload.id).toBeDefined();
    expect(payload.name).toBeDefined();
  });

  it("emits stateClick and update:focus on a touch tap", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const el = wrapper.find(".state-path").element;
    dispatchTouch(el, "touchstart", [{ clientX: 100, clientY: 100 }]);
    dispatchTouch(el, "touchend", [{ clientX: 102, clientY: 99 }]);

    expect(wrapper.emitted("stateClick")).toHaveLength(1);
    const id = (wrapper.emitted("stateClick")![0][0] as { id: string }).id;
    expect(id).toBeDefined();
    // Tapping an unfocused feature focuses it.
    expect(wrapper.emitted("update:focus")![0][0]).toBe(id);
  });

  it("does not select when a touch drags (pan, not a tap)", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const el = wrapper.find(".state-path").element;
    dispatchTouch(el, "touchstart", [{ clientX: 100, clientY: 100 }]);
    // Lifted 40px away — that's a pan, left to d3-zoom.
    dispatchTouch(el, "touchend", [{ clientX: 100, clientY: 140 }]);
    expect(wrapper.emitted("stateClick")).toBeUndefined();
  });

  it("does not select when a second finger joins (pinch, not a tap)", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const el = wrapper.find(".state-path").element;
    dispatchTouch(el, "touchstart", [
      { clientX: 100, clientY: 100 },
      { clientX: 150, clientY: 150 },
    ]);
    dispatchTouch(el, "touchend", [{ clientX: 100, clientY: 100 }]);
    expect(wrapper.emitted("stateClick")).toBeUndefined();
  });

  it("renders categorical legend with circles and labels", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: "high" }],
        colorScale: [
          { value: "low", color: "#aaa" },
          { value: "high", color: "#f00" },
        ],
        legendTitle: "Risk",
      },
    });
    const legend = wrapper.find(".choropleth-legend");
    expect(legend.exists()).toBe(true);
    expect(legend.find(".choropleth-legend-title").text()).toBe("Risk");
    const items = legend.findAll(".choropleth-legend-item");
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe("low");
    expect(items[1].text()).toBe("high");
    expect(legend.findAll(".choropleth-legend-swatch")).toHaveLength(2);
  });

  it("renders threshold legend with circles and labels", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        colorScale: [
          { min: 0, color: "#aaa", label: "Low" },
          { min: 50, color: "#f00", label: "High" },
        ],
        legendTitle: "Level",
      },
    });
    const legend = wrapper.find(".choropleth-legend");
    expect(legend.exists()).toBe(true);
    expect(legend.find(".choropleth-legend-title").text()).toBe("Level");
    const items = legend.findAll(".choropleth-legend-item");
    expect(items[0].text()).toBe("Low");
    expect(items[1].text()).toBe("High");
  });

  it("renders threshold legend with min values when no label", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        colorScale: [
          { min: 0, color: "#aaa" },
          { min: 50, color: "#f00" },
        ],
      },
    });
    const items = wrapper
      .find(".choropleth-legend")
      .findAll(".choropleth-legend-item");
    expect(items[0].text()).toBe("0");
    expect(items[1].text()).toBe("50");
  });

  it("renders continuous legend with gradient bar and ticks", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 0 },
          { id: "36", value: 100 },
        ],
        legendTitle: "Severity",
      },
    });
    const legend = wrapper.find(".choropleth-legend");
    expect(legend.exists()).toBe(true);
    expect(legend.find(".choropleth-legend-title").text()).toBe("Severity");
    const gradient = legend.find(".choropleth-legend-gradient");
    expect(gradient.exists()).toBe(true);
    expect(gradient.attributes("style") || "").toContain("linear-gradient");
    const ticks = legend.findAll(".choropleth-legend-ticks > span");
    expect(ticks.length).toBeGreaterThanOrEqual(3);
  });

  it("hides legend when legend=false", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        legend: false,
      },
    });
    expect(wrapper.find(".choropleth-legend").exists()).toBe(false);
  });

  it("renders county paths when geoType is counties", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
      },
    });
    const paths = wrapper.findAll(".state-path");
    // us-atlas counties-10m has 3231 county geometries
    expect(paths.length).toBeGreaterThanOrEqual(3000);
  });

  it("colors counties by FIPS id", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        data: [
          { id: "04015", value: 100 }, // Mohave County, AZ
          { id: "06037", value: 0 }, // Los Angeles County, CA
        ],
      },
    });
    const mohave = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("Mohave"));
    expect(mohave).toBeDefined();
    expect(mohave!.attributes("fill")).not.toBe("#ddd");
  });

  it("renders state borders overlay in county mode", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
      },
    });
    // State borders path rendered after the county paths group
    const allPaths = wrapper.findAll("path");
    const borderPath = allPaths.find(
      (p) =>
        p.attributes("fill") === "none" &&
        p.attributes("pointer-events") === "none",
    );
    expect(borderPath).toBeDefined();
  });

  it("does not render state borders in states mode", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const allPaths = wrapper.findAll("path");
    const borderPath = allPaths.find(
      (p) =>
        p.attributes("fill") === "none" &&
        p.attributes("pointer-events") === "none",
    );
    expect(borderPath).toBeUndefined();
  });

  it("renders HSA paths when geoType is hsas", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "hsas",
      },
    });
    await flushDynamicImports();
    const paths = wrapper.findAll(".state-path");
    // 949 unique HSAs
    expect(paths.length).toBeGreaterThanOrEqual(900);
    expect(paths.length).toBeLessThan(1000);
  });

  it("colors HSAs by HSA code", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "hsas",
        data: [
          { id: "010259", value: 100 }, // Butler, AL
          { id: "010177", value: 0 }, // Calhoun (Anniston), AL
        ],
      },
    });
    await flushDynamicImports();
    const butler = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("Butler, AL"));
    expect(butler).toBeDefined();
    expect(butler!.attributes("fill")).not.toBe("#ddd");
  });

  it("renders state borders overlay in HSA mode", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "hsas",
      },
    });
    // Borders arrive with the features, once the lazy HSA module resolves
    // (nothing renders through the unfittable pre-module projection).
    await flushDynamicImports();
    const allPaths = wrapper.findAll("path");
    const borderPath = allPaths.find(
      (p) =>
        p.attributes("fill") === "none" &&
        p.attributes("pointer-events") === "none",
    );
    expect(borderPath).toBeDefined();
  });

  it("emits stateHover on mouseover/mouseout", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const firstPath = wrapper.find(".state-path");
    await firstPath.trigger("mouseover");
    expect(wrapper.emitted("stateHover")).toHaveLength(1);
    expect(wrapper.emitted("stateHover")![0][0]).not.toBeNull();
    await firstPath.trigger("mouseout");
    expect(wrapper.emitted("stateHover")).toHaveLength(2);
    expect(wrapper.emitted("stateHover")![1][0]).toBeNull();
  });

  it("renders #tooltip slot content on hover and stays mounted on mouseout", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 42 }],
      },
      slots: {
        tooltip: `<template #tooltip="{ name, value }">
          <div class="custom-tip">{{ name }} :: {{ value }}</div>
        </template>`,
      },
    });
    // Slot presence should suppress the native SVG <title> fallback.
    expect(wrapper.find(".state-path title").exists()).toBe(false);

    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06");
    expect(california).toBeDefined();
    await california!.trigger("mouseover");
    // showTooltip awaits one tick to measure before positioning; flush
    // microtasks so the direct DOM write has happened.
    await flushPromises();

    const tip = document.body.querySelector(".custom-tip");
    expect(tip).not.toBeNull();
    expect(tip!.textContent).toContain("California :: 42");
    const tipWrapper = tip!.parentElement as HTMLElement;
    expect(tipWrapper.style.visibility).toBe("visible");

    // On mouseout the slot DOM stays mounted; only visibility flips so the
    // next hover patches props rather than remounting.
    await california!.trigger("mouseout");
    await flushPromises();
    const tipAfter = document.body.querySelector(".custom-tip");
    expect(tipAfter).toBe(tip);
    expect((tipAfter!.parentElement as HTMLElement).style.visibility).toBe(
      "hidden",
    );

    wrapper.unmount();
  });

  it("renders tooltipFormat HTML when no slot is provided", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 42 }],
        tooltipFormat: ({ name, value }) =>
          `<b class="legacy-tip">${name}=${value}</b>`,
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06");
    await california!.trigger("mouseover");
    await flushPromises();

    const tip = document.body.querySelector(".legacy-tip");
    expect(tip).not.toBeNull();
    expect(tip!.textContent).toBe("California=42");

    wrapper.unmount();
  });

  it("emits update:focus with the clicked feature id", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06");
    await clickSelect(california!);
    const events = wrapper.emitted("update:focus");
    expect(events).toHaveLength(1);
    expect(events![0][0]).toBe("06");
  });

  it("emits null when clicking the currently focused feature (toggle off)", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400, focus: "06" },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06");
    await clickSelect(california!);
    const events = wrapper.emitted("update:focus");
    expect(events).toHaveLength(1);
    expect(events![0][0]).toBeNull();
  });

  it("toggle works when focus is set by name rather than id", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: "California",
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06");
    await clickSelect(california!);
    expect(wrapper.emitted("update:focus")![0][0]).toBeNull();
  });

  it("applies a non-identity transform when focus prop is set", async () => {
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
    const g = wrapper.find("g");
    const transform = g.attributes("transform") ?? "";
    // d3-zoom serializes as "translate(x,y) scale(k)".
    expect(transform).toContain("scale(5)");
    expect(transform).toMatch(/^translate\(/);
    wrapper.unmount();
  });

  it("resolves focus by feature name as well as id", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: "California",
        focusZoomLevel: 3,
      },
    });
    await flushPromises();
    const g = wrapper.find("g");
    expect(g.attributes("transform") ?? "").toContain("scale(3)");
    wrapper.unmount();
  });

  it("preserves the zoom transform when focus is set back to null", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: "06",
        focusZoomLevel: 3,
      },
    });
    await flushPromises();
    const before = wrapper.find("g").attributes("transform") ?? "";
    expect(before).toContain("scale(3)");
    await wrapper.setProps({ focus: null });
    await flushPromises();
    // Wait long enough for any (unwanted) animation to have completed.
    await new Promise((r) => setTimeout(r, 550));
    // Unfocus keeps the current pan/zoom — only Reset returns to identity.
    const after = wrapper.find("g").attributes("transform") ?? "";
    expect(after).toBe(before);
    wrapper.unmount();
  });

  it("shows the focused feature's tooltip when a tooltip slot is configured", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 42 }],
        focus: "06",
      },
      slots: {
        tooltip: `<template #tooltip="{ name, value }">
          <div class="focus-tip">{{ name }} :: {{ value }}</div>
        </template>`,
      },
    });
    await flushPromises();
    const tip = document.body.querySelector(".focus-tip");
    expect(tip).not.toBeNull();
    expect(tip!.textContent).toContain("California :: 42");
    const tipWrapper = tip!.parentElement as HTMLElement;
    expect(tipWrapper.style.visibility).toBe("visible");
    wrapper.unmount();
  });

  it("rapid focus changes don't chain animations end-to-end", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focusZoomLevel: 3,
      },
    });
    await flushPromises();
    // Trigger zoom-in to CA, then immediately retarget to TX before the
    // first animation finishes. Without svg.interrupt(), d3-transition
    // would queue the second transition and the map would visibly fly
    // through CA before settling on TX.
    await wrapper.setProps({ focus: "06" });
    await wrapper.setProps({ focus: "48" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 550));
    const transform = wrapper.find("g").attributes("transform") ?? "";
    expect(transform).toContain("scale(3)");
    wrapper.unmount();
  });

  it("applies the hover-style highlight to focused features", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: "06",
      },
    });
    await flushPromises();
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    // Theme-following default: pure black (light) / white (dark), applied
    // as inline style so light-dark() resolves.
    expect(strokeStyle(california)).toContain("choropleth-highlight");
    // Pick any other state and confirm it kept the default stroke.
    const other = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") !== "06")!;
    expect(strokeStyle(other)).toBe("");
    wrapper.unmount();
  });

  it("accepts an array of ids to focus on multiple features", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: ["06", "36"],
        focusZoomLevel: 2,
      },
    });
    await flushPromises();
    expect(wrapper.find("g").attributes("transform") ?? "").toContain(
      "scale(2)",
    );
    wrapper.unmount();
  });

  it("renders a cross-geoType FocusItem as a non-interactive overlay path", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "hsas",
        width: 600,
        height: 400,
        focus: [
          { id: "060766", geoType: "hsas" },
          { id: "06037", geoType: "counties", style: "dashed" },
        ],
        focusZoomLevel: 4,
      },
    });
    await flushPromises();
    const overlays = wrapper.findAll(".focus-overlay");
    expect(overlays.length).toBe(1);
    const overlay = overlays[0];
    expect(overlay.attributes("stroke")).toBe("#fff");
    expect(overlay.attributes("stroke-dasharray")).toBe("8 4");
    expect(overlay.attributes("pointer-events")).toBe("none");
    expect(overlay.attributes("fill")).toBe("none");
    wrapper.unmount();
  });

  it("honors FocusItem.stroke for cross-geoType overlays", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        focus: { id: "060737", geoType: "hsas", stroke: "#666" },
      },
    });
    await flushDynamicImports();
    const overlay = wrapper.find(".focus-overlay");
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes("stroke")).toBe("#666");
    wrapper.unmount();
  });

  it("removes cross-geoType overlays when focus is cleared", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "hsas",
        width: 600,
        height: 400,
        focus: [
          { id: "060766", geoType: "hsas" },
          { id: "06037", geoType: "counties", style: "dashed" },
        ],
      },
    });
    await flushPromises();
    expect(wrapper.findAll(".focus-overlay").length).toBe(1);
    await wrapper.setProps({ focus: null });
    await flushPromises();
    expect(wrapper.findAll(".focus-overlay").length).toBe(0);
    wrapper.unmount();
  });

  it("applies a solid overlay when style is omitted on a cross-geoType item", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "hsas",
        width: 600,
        height: 400,
        focus: { id: "06037", geoType: "counties" },
      },
    });
    await flushPromises();
    const overlay = wrapper.find(".focus-overlay");
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes("stroke-dasharray")).toBeUndefined();
    wrapper.unmount();
  });

  it("colors a county base map by HSA values when dataGeoType=hsas", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        dataGeoType: "hsas" as const,
        width: 600,
        height: 400,
        // HSA 060723 is LA County's HSA (per fipsToHsa).
        data: [{ id: "060723", value: 100 }],
      },
    });
    await flushPromises();
    // LA County (06037) should pick up HSA 060766's value → not noData.
    const la = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06037")!;
    expect(la).toBeDefined();
    expect(la.attributes("fill")).not.toBe("#ddd");
    // A county in a different HSA should keep the noData fill.
    const other = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "36061")!;
    expect(other.attributes("fill")).toBe("#ddd");
    wrapper.unmount();
  });

  it("resolves county fills to parent state values when dataGeoType=states", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        dataGeoType: "states" as const,
        width: 600,
        height: 400,
        // Every California county should pick up "06"'s value.
        data: [{ id: "06", value: 50 }],
      },
    });
    await flushPromises();
    const laFill = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06037")!
      .attributes("fill");
    const sfFill = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06075")!
      .attributes("fill");
    expect(laFill).toBe(sfFill);
    expect(laFill).not.toBe("#ddd");
    wrapper.unmount();
  });

  it("supports name-based data lookup against the data's geoType", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        dataGeoType: "states" as const,
        width: 600,
        height: 400,
        // State name instead of FIPS — should resolve via the states name index.
        data: [{ id: "California", value: 99 }],
      },
    });
    await flushPromises();
    const la = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06037")!;
    expect(la.attributes("fill")).not.toBe("#ddd");
    wrapper.unmount();
  });

  it("applies the dotted stroke pattern to a cross-geoType FocusItem", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        focus: { id: "060737", geoType: "hsas", style: "dotted" },
      },
    });
    await flushDynamicImports();
    const overlay = wrapper.find(".focus-overlay");
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes("stroke-dasharray")).toBe("0 5");
    expect(overlay.attributes("stroke-linecap")).toBe("round");
    wrapper.unmount();
  });

  it("applies a dashed stroke-dasharray to a same-geoType FocusItem", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: { id: "06", style: "dashed" },
      },
    });
    await flushPromises();
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(strokeStyle(california)).toContain("choropleth-highlight");
    expect(california.attributes("stroke-dasharray")).toBe("8 4");
    wrapper.unmount();
  });

  it("honors FocusItem stroke and strokeWidth on in-place highlights", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: { id: "06", stroke: "red", strokeWidth: 3 },
        focusZoom: false,
      },
    });
    await flushPromises();
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(strokeStyle(california)).toBe("red");
    // Visual width 3 at identity zoom → attribute width 3.
    expect(california.attributes("stroke-width")).toBe("3");
    wrapper.unmount();
  });

  it("honors FocusItem stroke and strokeWidth on cross-geoType overlays", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        focus: {
          id: "060766",
          geoType: "hsas",
          stroke: "#666",
          strokeWidth: 4,
        },
        focusZoom: false,
      },
    });
    await flushDynamicImports();
    const overlay = wrapper.find(".focus-overlay");
    expect(overlay.attributes("stroke")).toBe("#666");
    expect(overlay.attributes("stroke-width")).toBe("4");
    wrapper.unmount();
  });

  it("zooms to the focused feature by default", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: { topology: statesTopo, width: 600, height: 400, focus: "06" },
    });
    await flushPromises();
    // Zoom applied even without the `zoom` interaction enabled.
    expect(wrapper.find("g").attributes("transform")).toContain("scale(4)");
    wrapper.unmount();
  });

  it("highlights without zooming when focusZoom is false", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        focus: "06",
        focusZoom: false,
      },
    });
    await flushPromises();
    // The focused feature is still highlighted...
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(strokeStyle(california)).toContain("choropleth-highlight");
    // ...but the map didn't pan/zoom — no transform was ever applied.
    expect(wrapper.find("g").attributes("transform")).toBeUndefined();
    wrapper.unmount();
  });

  it("draws a cross-geoType overlay without zooming when focusZoom is false", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        focus: { id: "060766", geoType: "hsas" },
        focusZoom: false,
      },
    });
    await flushDynamicImports();
    expect(wrapper.find(".focus-overlay").exists()).toBe(true);
    expect(wrapper.find("g").attributes("transform")).toBeUndefined();
    wrapper.unmount();
  });

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
});

describe("ChoroplethMap single-state mode", () => {
  it("scopes counties to a single state by name", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "California",
      },
    });
    const paths = wrapper.findAll(".state-path");
    // California has 58 counties, all with FIPS prefix "06".
    expect(paths.length).toBe(58);
    expect(
      paths.every((p) => p.attributes("data-feat-id")!.startsWith("06")),
    ).toBe(true);
  });

  it("scopes counties to a single state by FIPS code", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "06",
      },
    });
    const paths = wrapper.findAll(".state-path");
    expect(paths.length).toBe(58);
    expect(
      paths.every((p) => p.attributes("data-feat-id")!.startsWith("06")),
    ).toBe(true);
  });

  it("scopes HSAs to a single state", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "hsas",
        state: "California",
      },
    });
    await flushDynamicImports();
    const paths = wrapper.findAll(".state-path");
    // A handful of HSAs, far fewer than the national 949, all "06"-prefixed.
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.length).toBeLessThan(200);
    expect(
      paths.every((p) => p.attributes("data-feat-id")!.startsWith("06")),
    ).toBe(true);
  });

  it("renders a single state outline instead of the national border mesh", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "California",
      },
    });
    const borderPaths = wrapper
      .findAll("path")
      .filter(
        (p) =>
          p.attributes("fill") === "none" &&
          p.attributes("pointer-events") === "none",
      );
    expect(borderPaths.length).toBe(1);
    expect(borderPaths[0].attributes("d")).toBeTruthy();
  });

  it("colors only the scoped state's counties from national data", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "California",
        data: [
          { id: "06037", value: 100 }, // Los Angeles County, CA — in scope
          { id: "04015", value: 50 }, // Mohave County, AZ — out of scope
        ],
      },
    });
    const paths = wrapper.findAll(".state-path");
    const la = paths.find((p) =>
      p.find("title").text().includes("Los Angeles"),
    );
    expect(la).toBeDefined();
    expect(la!.attributes("fill")).not.toBe("#ddd");
    // The out-of-state county isn't rendered at all.
    expect(
      paths.find((p) => p.attributes("data-feat-id") === "04015"),
    ).toBeUndefined();
  });

  it("resets pan/zoom when the state changes", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "California",
        focus: "06037", // focusZoom defaults true → zooms in (Reset appears)
      },
    });
    await flushPromises();
    expect(wrapper.find("g").attributes("transform")).not.toContain("scale(1)");
    // Switch regions. Clearing focus alone preserves the transform, so an
    // identity transform proves the state change reset the zoom.
    await wrapper.setProps({ state: "Texas", focus: null });
    await flushPromises();
    expect(wrapper.find("g").attributes("transform")).toContain("scale(1)");
    wrapper.unmount();
  });

  it("falls back to the full map and warns for an unknown state", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "Atlantis",
      },
    });
    const paths = wrapper.findAll(".state-path");
    expect(paths.length).toBeGreaterThanOrEqual(3000);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('state="Atlantis"'),
    );
    warn.mockRestore();
  });

  it("renders an island territory without NaN paths (Mercator fallback)", () => {
    // geoAlbersUsa doesn't cover Puerto Rico, so fitExtent would otherwise
    // yield a NaN transform and every path would render as "MNaN,NaN…".
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "Puerto Rico",
      },
    });
    const paths = wrapper.findAll("path");
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p.attributes("d") ?? "").not.toContain("NaN");
    }
  });

  it("highlights a cross-geoType HSA overlay on a county state map", async () => {
    // "Click a county, highlight its HSA": a counties base map scoped to one
    // state, with an HSA focused as a cross-geoType overlay.
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "California",
        dataGeoType: "hsas",
        focus: { id: "060766", geoType: "hsas" }, // a California HSA
      },
    });
    await flushDynamicImports();
    const overlay = wrapper.find(".focus-overlay");
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes("fill")).toBe("none");
    expect(overlay.attributes("pointer-events")).toBe("none");
    // The overlay is projected through the state projection — it must have a
    // real, finite path.
    const d = overlay.attributes("d") ?? "";
    expect(d.length).toBeGreaterThan(0);
    expect(d).not.toContain("NaN");
    wrapper.unmount();
  });

  it("emits stateClick and update:focus for a county on the state map", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "counties",
        state: "California",
      },
    });
    const county = wrapper.find(".state-path");
    await clickSelect(county);
    const click = wrapper.emitted("stateClick");
    expect(click).toHaveLength(1);
    const payload = click![0][0] as { id: string; name: string };
    // Only California counties are present, so the clicked id is "06"-scoped.
    expect(payload.id.startsWith("06")).toBe(true);
    expect(wrapper.emitted("update:focus")![0][0]).toBe(payload.id);
  });
});

describe("ChoroplethMap accessibility", () => {
  it("has no role or aria-label when unlabeled", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    const root = wrapper.find(".choropleth-wrapper");
    expect(root.attributes("role")).toBeUndefined();
    expect(root.attributes("aria-label")).toBeUndefined();
  });

  it("labels the map as a figure using the title by default", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        title: "Cases by state",
      },
    });
    const root = wrapper.find(".choropleth-wrapper");
    expect(root.attributes("role")).toBe("figure");
    expect(root.attributes("aria-label")).toBe("Cases by state");
  });

  it("prefers ariaLabel over title and honors a role override", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        title: "Cases",
        ariaLabel: "US map shaded by case count per state",
        role: "img",
      },
    });
    const root = wrapper.find(".choropleth-wrapper");
    expect(root.attributes("role")).toBe("img");
    expect(root.attributes("aria-label")).toBe(
      "US map shaded by case count per state",
    );
  });
});

describe("ChoroplethMap city overlay", () => {
  // The overlay is painted in a requestAnimationFrame callback; let it run.
  async function flushCityLayout() {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await flushPromises();
  }

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
    await flushCityLayout();
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
    await flushCityLayout();
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
    await flushCityLayout();
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
    await flushCityLayout();
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
    await flushCityLayout();
    expect(
      layerOf(wrapper).element.querySelectorAll(".choropleth-city-dot"),
    ).toHaveLength(3);
  });

  it("puts the city layer in its own overlay svg (so it paints above the canvas backend)", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 800, height: 500, cities: CITIES },
    });
    await flushCityLayout();
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
    await flushCityLayout();
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
    await flushCityLayout();
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
    await flushCityLayout();
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
    await flushCityLayout();
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

  // The state-borders mesh path: fill="none", not the outline or an overlay.
  const bordersPath = (wrapper: ReturnType<typeof mount>) =>
    mapSvg(wrapper)
      .findAll("path")
      .find(
        (p) =>
          p.attributes("fill") === "none" &&
          !p.classes("choropleth-outline") &&
          !p.classes("focus-overlay"),
      );

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

  it("defaults feature strokes to the light constant in test DOMs", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    expect(wrapper.find(".state-path").attributes("stroke")).toBe("#fff");
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
