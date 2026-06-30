import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// HSA mapping is dynamic-imported inside ChoroplethMap to keep the main
// bundle small. Tests that exercise hsas geoType or cross-geoType focus
// must await both the dynamic import and the Vue render that follows.
async function flushDynamicImports() {
  await vi.dynamicImportSettled();
  await flushPromises();
}
import ChoroplethMap from "./ChoroplethMap.vue";
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
    await firstPath.trigger("click");
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

  it("renders state borders overlay in HSA mode", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "hsas",
      },
    });
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
    await california!.trigger("click");
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
    await california!.trigger("click");
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
    await california!.trigger("click");
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
    expect(california.attributes("stroke")).toBe("#555");
    // Pick any other state and confirm it kept the default stroke.
    const other = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") !== "06")!;
    expect(other.attributes("stroke")).not.toBe("#555");
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
    expect(california.attributes("stroke")).toBe("#555");
    expect(california.attributes("stroke-dasharray")).toBe("8 4");
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
    await county.trigger("click");
    const click = wrapper.emitted("stateClick");
    expect(click).toHaveLength(1);
    const payload = click![0][0] as { id: string; name: string };
    // Only California counties are present, so the clicked id is "06"-scoped.
    expect(payload.id.startsWith("06")).toBe(true);
    expect(wrapper.emitted("update:focus")![0][0]).toBe(payload.id);
  });
});
