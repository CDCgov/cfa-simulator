import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import ChoroplethMap from "./ChoroplethMap.vue";
import {
  autoUnmount,
  statesTopo,
  countiesTopo,
  flushDynamicImports,
  dispatchTouch,
  strokeStyle,
  pathFor,
  clickSelect,
} from "./ChoroplethMap.testUtils.js";

// Touch detection is probed per event, so tests can flip devices per case.
// happy-dom defaults to a mouse-only environment.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

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

  it("keeps per-feature aria-labels in sync with data when an interactive tooltip is set", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 42 }],
        tooltipFormat: (d: { name: string }) => `<b>${d.name}</b>`,
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(california.find("title").exists()).toBe(false);
    expect(california.attributes("aria-label")).toBe("California: 42");

    await wrapper.setProps({ data: [{ id: "06", value: 99 }] });
    expect(california.attributes("aria-label")).toBe("California: 99");
    wrapper.unmount();
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

  it("applies categorical color scale with optional stop styling", async () => {
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
          {
            value: "high",
            color: "#red1",
            stroke: "#red2",
            highlight: "#red3",
          },
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
    expect(california!.attributes("stroke")).toBe("#red2");
    expect(ny!.attributes("fill")).toBe("#green1");
    expect(tx!.attributes("fill")).toBe("#yellow1");
    await california!.trigger("mouseover");
    expect(strokeStyle(california!)).toBe("#red3");
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

  it("pins the continuous scale to colorScale.domain", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        colorScale: { min: "#000000", max: "#ffffff", domain: [0, 100] },
      },
    });
    const ticks = wrapper.findAll(".choropleth-legend-ticks > span");
    expect(ticks.map((t) => t.text())).toEqual(["25", "50", "75"]);
    expect(pathFor(wrapper, "06").attributes("fill")).toBe("rgb(128,128,128)");
  });

  it("clamps values outside a fixed domain to the end colors", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 250 },
          { id: "36", value: -10 },
        ],
        colorScale: { min: "#000000", max: "#ffffff", domain: [0, 100] },
      },
    });
    expect(pathFor(wrapper, "06").attributes("fill")).toBe("rgb(255,255,255)");
    expect(pathFor(wrapper, "36").attributes("fill")).toBe("rgb(0,0,0)");
  });

  it("warns once about regions with data the projection cannot place", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = [
      { id: "06", value: 1 },
      { id: "72", value: 2 },
    ];
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400, data },
    });
    const unplaced = () =>
      warn.mock.calls.filter(([m]) => String(m).includes("cannot place"));
    expect(unplaced()).toHaveLength(1);
    expect(String(unplaced()[0][0])).toContain("1 region with data (72)");
    expect(pathFor(wrapper, "72").attributes("d") ?? "").toBe("");
    warn.mockRestore();
  });

  it("warns again only when the set of unplaced regions changes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unplaced = () =>
      warn.mock.calls.filter(([m]) => String(m).includes("cannot place"));
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [{ id: "72", value: 1 }],
      },
    });
    await wrapper.setProps({ data: [{ id: "72", value: 2 }] });
    expect(unplaced()).toHaveLength(1);
    await wrapper.setProps({
      data: [
        { id: "72", value: 2 },
        { id: "66", value: 3 },
      ],
    });
    expect(unplaced()).toHaveLength(2);
    expect(String(unplaced()[1][0])).toContain("2 regions with data");
    await wrapper.setProps({ projection: "albersUsaTerritories" });
    expect(unplaced()).toHaveLength(2);
    warn.mockRestore();
  });

  it("draws Puerto Rico with the albersUsaTerritories projection", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        projection: "albersUsaTerritories",
        data: [
          { id: "06", value: 1 },
          { id: "72", value: 2 },
        ],
      },
    });
    const d = pathFor(wrapper, "72").attributes("d") ?? "";
    expect(d).toMatch(/^M[\d.]+,[\d.]+/);
    expect(d).not.toContain("NaN");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns on an invalid domain and falls back to the data extent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        data: [
          { id: "06", value: 0 },
          { id: "36", value: 100 },
        ],
        colorScale: { min: "#000000", max: "#ffffff", domain: [100, 0] },
      },
    });
    expect(
      warn.mock.calls.filter(([m]) => String(m).includes("colorScale.domain")),
    ).toHaveLength(1);
    const ticks = wrapper.findAll(".choropleth-legend-ticks > span");
    expect(ticks.map((t) => t.text())).toEqual(["25", "50", "75"]);
    expect(pathFor(wrapper, "36").attributes("fill")).toBe("rgb(255,255,255)");
    warn.mockRestore();
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
    expect(wrapper.find(".choropleth-state-borders").exists()).toBe(true);
  });

  it("does not render state borders in states mode", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    expect(wrapper.find(".choropleth-state-borders").exists()).toBe(false);
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
    expect(wrapper.find(".choropleth-wrapper").classes()).toContain(
      "is-geometry-pending",
    );
    expect(wrapper.find(".choropleth-wrapper").attributes("aria-busy")).toBe(
      "true",
    );
    await flushDynamicImports();
    expect(wrapper.find(".choropleth-wrapper").classes()).not.toContain(
      "is-geometry-pending",
    );
    expect(
      wrapper.find(".choropleth-wrapper").attributes("aria-busy"),
    ).toBeUndefined();
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
    expect(wrapper.find(".choropleth-state-borders").exists()).toBe(true);
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

  it("turns the tooltip on and off as the parent adds or drops its #tooltip slot", async () => {
    const show = ref(true);
    const Parent = defineComponent({
      setup() {
        return () =>
          h(
            ChoroplethMap,
            {
              topology: statesTopo,
              width: 600,
              height: 400,
              data: [{ id: "06", value: 42 }],
            },
            show.value
              ? {
                  tooltip: ({ name }: { name: string }) =>
                    h("div", { class: "custom-tip" }, name),
                }
              : {},
          );
      },
    });
    const wrapper = mount(Parent, { attachTo: document.body });
    const svg = wrapper.find("svg").element;
    const california = () =>
      wrapper
        .findAll(".state-path")
        .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(0);
    expect(wrapper.find(".state-path title").exists()).toBe(false);
    expect(
      document.body.querySelector(".chart-tooltip-content"),
    ).not.toBeNull();

    // Dropping the slot: no remount, the <title> fallback comes back and
    // the teleported tooltip goes.
    show.value = false;
    await nextTick();
    await flushPromises();
    expect(wrapper.find("svg").element).toBe(svg);
    expect(wrapper.find(".state-path title").exists()).toBe(true);
    expect(document.body.querySelector(".chart-tooltip-content")).toBeNull();

    // Adding it back turns the tooltip on again.
    show.value = true;
    await nextTick();
    await flushPromises();
    expect(wrapper.find("svg").element).toBe(svg);
    expect(wrapper.find(".state-path title").exists()).toBe(false);
    await california().trigger("mouseover");
    await flushPromises();
    expect(document.body.querySelector(".custom-tip")?.textContent).toBe(
      "California",
    );
    wrapper.unmount();
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
    // Slot presence suppresses the native SVG <title> (it would double up
    // with the HTML tooltip) but every feature keeps its accessible name.
    expect(wrapper.find(".state-path title").exists()).toBe(false);

    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06");
    expect(california).toBeDefined();
    expect(california!.attributes("role")).toBe("img");
    expect(california!.attributes("aria-label")).toBe("California: 42");
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

  it("suppresses hover tooltips through a resize and recovers on the next move", async () => {
    // Regression: each window-resize tick dismissed the tooltip, but the
    // browser's synthetic re-entry mouseover after every relayout re-showed
    // it — the tooltip flickered through a drag-resize. Hover must stay
    // suppressed until resize events stop arriving (a trailing settle
    // window), then re-establish from the first real mousemove — no feature
    // boundary crossing required, since that mouseover was swallowed.
    vi.useFakeTimers();
    try {
      const wrapper = mount(ChoroplethMap, {
        attachTo: document.body,
        props: {
          topology: statesTopo,
          width: 600,
          height: 400,
          tooltipTrigger: "hover",
          data: [{ id: "06", value: 42 }],
        },
      });
      const california = wrapper
        .findAll(".state-path")
        .find((p) => p.attributes("data-feat-id") === "06")!;
      await california.trigger("mouseover", { clientX: 100, clientY: 100 });
      const tip = document.body.querySelector<HTMLElement>(
        ".chart-tooltip-content",
      )!;
      expect(tip.style.visibility).toBe("visible");

      // A resize tick dismisses the tooltip…
      window.dispatchEvent(new Event("resize"));
      expect(tip.style.visibility).toBe("hidden");
      expect(wrapper.emitted("stateHover")).toHaveLength(2); // hover + null

      // …and the synthetic mouseover landing inside the settle window must
      // not flash it back.
      await california.trigger("mouseover", { clientX: 100, clientY: 100 });
      expect(tip.style.visibility).toBe("hidden");
      expect(wrapper.emitted("stateHover")).toHaveLength(2);

      // Once resize events stop, the first real move restores the hover.
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
      expect(wrapper.emitted("stateHover")).toHaveLength(3);

      wrapper.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses the tooltip only for scrolls that move the map", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        tooltipTrigger: "hover",
        data: [{ id: "06", value: 42 }],
      },
    });
    const panel = document.createElement("div");
    document.body.appendChild(panel);
    await wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!
      .trigger("mouseover", { clientX: 100, clientY: 100 });
    const tip = document.body.querySelector<HTMLElement>(
      ".chart-tooltip-content",
    )!;
    expect(tip.style.visibility).toBe("visible");

    panel.dispatchEvent(new Event("scroll"));
    expect(tip.style.visibility).toBe("visible");

    document.dispatchEvent(new Event("scroll"));
    expect(tip.style.visibility).toBe("hidden");

    panel.remove();
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
});
