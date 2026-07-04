import { describe, it, expect, vi, afterEach } from "vitest";
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

  it("uses noDataColor for states without data", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        noDataColor: "#eee",
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
    expect(strokeStyle(california)).toContain("light-dark");
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
    expect(strokeStyle(california)).toContain("light-dark");
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
    expect(strokeStyle(california)).toContain("light-dark");
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
    // ...and suppresses the browser's own double-tap zoom.
    expect(mapSvg().getAttribute("style") ?? "").toContain("manipulation");
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
    expect(strokeStyle(california)).toContain("light-dark");
    expect(wrapper.emitted("stateHover")?.[0]?.[0]).toMatchObject({
      id: "06",
      value: 42,
    });
    const tip = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    expect(tip.style.visibility).toBe("visible");
    expect(tip.textContent).toContain("California");
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
