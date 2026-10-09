import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import type { Topology } from "topojson-specification";
import { geoMercator } from "d3-geo";
import worldCountries from "world-atlas/countries-110m.json";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
import {
  strokeStyle,
  pathFor,
  clickSelect,
} from "./ChoroplethMap.testUtils.js";

// `vi.mock` is hoisted above the imports, so its factory stays inline.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

import ChoroplethMap from "./ChoroplethMap.vue";

const worldTopo = worldCountries as unknown as Topology;
const statesTopo = usStates as unknown as Topology;
const countiesTopo = usCounties as unknown as Topology;

// Rectangles in lon/lat, wound counter-clockwise (the RFC 7946 convention).
function rect(x0: number, y0: number, w: number, h: number): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [x0, y0],
        [x0 + w, y0],
        [x0 + w, y0 + h],
        [x0, y0 + h],
        [x0, y0],
      ],
    ],
  };
}

// A 3x2 grid of 10-degree squares keyed by `code`, named by `label`, and
// grouped into a west district (first two columns) and an east one.
const zones: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: ["A", "B"].flatMap((row, r) =>
    [1, 2, 3].map((col) => ({
      type: "Feature" as const,
      properties: {
        code: `${row}${col}`,
        label: `Zone ${row}${col}`,
        district: col === 3 ? "east" : "west",
      },
      geometry: rect((col - 1) * 10, r * 10, 10, 10),
    })),
  ),
};

const districts: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    ["west", 0, 20],
    ["east", 20, 10],
  ].map(([name, x, w]) => ({
    type: "Feature" as const,
    properties: { name },
    geometry: rect(x as number, 0, w as number, 20),
  })),
};

// Two squares sharing one edge, as a hand-built topology: arc 0 is the
// shared edge, arcs 1 and 2 are each square's remaining three sides.
const pairTopo = {
  type: "Topology",
  arcs: [
    [
      [10, 0],
      [10, 10],
    ],
    [
      [10, 10],
      [0, 10],
      [0, 0],
      [10, 0],
    ],
    [
      [10, 0],
      [20, 0],
      [20, 10],
      [10, 10],
    ],
  ],
  objects: {
    zones: {
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          arcs: [[0, 1]],
          id: "L",
          properties: { name: "Left" },
        },
        {
          type: "Polygon",
          arcs: [[-1, 2]],
          id: "R",
          properties: { name: "Right" },
        },
      ],
    },
  },
} as unknown as Topology;

const zoneRegions = {
  geojson: zones,
  idProperty: "code",
  nameProperty: "label",
};

function mountZones(extra: Record<string, unknown> = {}) {
  return mount(ChoroplethMap, {
    props: { regions: zoneRegions, width: 600, height: 400, ...extra },
  });
}

const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChoroplethMap regions (custom geography)", () => {
  it("renders one path per GeoJSON feature, keyed and named by the given properties", () => {
    const wrapper = mountZones({ data: [{ id: "A1", value: 5 }] });
    const paths = wrapper.findAll(".state-path");
    expect(paths.map((p) => p.attributes("data-feat-id")).sort()).toEqual([
      "A1",
      "A2",
      "A3",
      "B1",
      "B2",
      "B3",
    ]);
    expect(pathFor(wrapper, "A1").attributes("aria-label")).toBe("Zone A1: 5");
    expect(pathFor(wrapper, "B2").attributes("aria-label")).toBe("Zone B2");
    for (const p of paths) {
      expect(p.attributes("d")).toMatch(/^M-?\d/);
      expect(p.attributes("d")).not.toContain("NaN");
    }
  });

  it("rewinds counter-clockwise rings so each region is the small polygon", () => {
    // Without rewinding d3-geo would draw each fixture square as the rest
    // of the globe.
    const wrapper = mountZones();
    const d = pathFor(wrapper, "A1").attributes("d")!;
    const xs = [...d.matchAll(/[ML](-?[\d.]+),/g)].map((m) => Number(m[1]));
    expect(xs.length).toBeGreaterThan(3);
    // One 10-degree square of a 30-degree-wide grid: well under a third
    // of the fitted width.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1000 / 3);
    expect(d.match(/M/g)).toHaveLength(1);
  });

  it("falls back to the feature id and `name` property by default (TopoJSON)", () => {
    const warn = warnSpy();
    const wrapper = mount(ChoroplethMap, {
      props: {
        regions: { topology: worldTopo, object: "countries" },
        width: 600,
        height: 400,
        data: [{ id: "250", value: 3 }],
      },
    });
    // 177 countries, three of which (disputed territories) carry no id.
    expect(wrapper.findAll(".state-path")).toHaveLength(174);
    expect(pathFor(wrapper, "250").attributes("aria-label")).toBe("France: 3");
    expect(
      warn.mock.calls.some(([m]) => String(m).includes("3 feature(s)")),
    ).toBe(true);
  });

  it("draws the topology's first object when `object` is omitted", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { regions: { topology: pairTopo }, width: 600, height: 400 },
    });
    expect(
      wrapper.findAll(".state-path").map((p) => p.attributes("data-feat-id")),
    ).toEqual(["L", "R"]);
    expect(pathFor(wrapper, "L").attributes("aria-label")).toBe("Left");
  });

  it("colors regions by id or by name and ignores unknown ids", () => {
    const wrapper = mountZones({
      data: [
        { id: "A1", value: 0 },
        { id: "Zone B3", value: 100 },
        { id: "nowhere", value: 50 },
      ],
      colorScale: { min: "#000000", max: "#ffffff" },
    });
    expect(pathFor(wrapper, "A1").attributes("fill")).toBe("rgb(0,0,0)");
    expect(pathFor(wrapper, "B3").attributes("fill")).toBe("rgb(255,255,255)");
    expect(pathFor(wrapper, "A2").attributes("fill")).toBe("#ddd");
  });

  it("ignores data[].geoType and dataGeoType", () => {
    const wrapper = mountZones({
      data: [{ id: "A1", value: 7, geoType: "counties" }],
      dataGeoType: "hsas",
    });
    expect(pathFor(wrapper, "A1").attributes("aria-label")).toBe("Zone A1: 7");
  });

  it("supports threshold and categorical color scales", async () => {
    const wrapper = mountZones({
      data: [
        { id: "A1", value: 1 },
        { id: "A2", value: 50 },
      ],
      colorScale: [
        { min: 0, color: "#111111" },
        { min: 10, color: "#eeeeee" },
      ],
    });
    expect(pathFor(wrapper, "A1").attributes("fill")).toBe("#111111");
    expect(pathFor(wrapper, "A2").attributes("fill")).toBe("#eeeeee");
    expect(wrapper.findAll(".choropleth-legend-item")).toHaveLength(2);

    await wrapper.setProps({
      data: [
        { id: "A1", value: "low" },
        { id: "A2", value: "high" },
      ],
      colorScale: [
        { value: "low", color: "#222222" },
        { value: "high", color: "#dddddd" },
      ],
    });
    expect(pathFor(wrapper, "A1").attributes("fill")).toBe("#222222");
    expect(pathFor(wrapper, "A2").attributes("fill")).toBe("#dddddd");
  });

  it("highlights the focused region and toggles focus on click", async () => {
    const wrapper = mountZones({ focus: "A1" });
    expect(strokeStyle(pathFor(wrapper, "A1"))).toContain(
      "choropleth-highlight",
    );
    expect(strokeStyle(pathFor(wrapper, "A2"))).toBe("");
    await clickSelect(pathFor(wrapper, "A1"));
    expect(wrapper.emitted("update:focus")![0][0]).toBeNull();
    await clickSelect(pathFor(wrapper, "B2"));
    expect(wrapper.emitted("update:focus")![1][0]).toBe("B2");
    expect(wrapper.emitted("stateClick")![1][0]).toEqual({
      id: "B2",
      name: "Zone B2",
      value: undefined,
    });
  });

  it("treats a FocusItem's geoType as the base level", () => {
    const wrapper = mountZones({
      focus: { id: "Zone A3", geoType: "hsas", stroke: "red" },
    });
    expect(strokeStyle(pathFor(wrapper, "A3"))).toBe("red");
    expect(wrapper.findAll(".focus-overlay")).toHaveLength(0);
  });

  it("draws GeoJSON borders as a mesh path styled by theme.borders", () => {
    const wrapper = mountZones({
      regions: { ...zoneRegions, borders: { geojson: districts } },
      theme: { borders: "#123456" },
    });
    const borders = wrapper.find(".choropleth-state-borders");
    expect(borders.exists()).toBe(true);
    expect(borders.attributes("stroke")).toBe("#123456");
    expect(borders.attributes("d")).not.toContain("NaN");
  });

  it("meshes shared edges of a topology object for borders and draws the exterior outline", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        regions: {
          topology: pairTopo,
          object: "zones",
          borders: { object: "zones" },
        },
        theme: { outline: "#0a0" },
        width: 600,
        height: 400,
      },
    });
    const borders = wrapper.find(".choropleth-state-borders");
    expect(borders.exists()).toBe(true);
    // Only the shared edge is meshed: a single two-point line.
    expect(borders.attributes("d")).toMatch(/^M[^ML]+L[^ML]+$/);
    expect(wrapper.find(".choropleth-outline").exists()).toBe(true);
  });

  it("draws no exterior outline for GeoJSON regions", () => {
    const wrapper = mountZones({ theme: { outline: "#0a0" } });
    expect(wrapper.find(".choropleth-outline").exists()).toBe(false);
  });

  it("fits the named projection and accepts a projection factory", () => {
    const mercator = mountZones();
    const equalEarth = mountZones({ projection: "equalEarth" });
    expect(pathFor(equalEarth, "A1").attributes("d")).not.toBe(
      pathFor(mercator, "A1").attributes("d"),
    );

    const factory = vi.fn((_w: number, _h: number) =>
      geoMercator().rotate([-15, -10]),
    );
    const custom = mountZones({ projection: factory });
    // Canonical width, height from the 600x400 aspect ratio.
    expect(factory.mock.calls[0][0]).toBe(1000);
    expect(factory.mock.calls[0][1]).toBeCloseTo(666.67, 1);
    expect(pathFor(custom, "A1").attributes("d")).not.toBe(
      pathFor(mercator, "A1").attributes("d"),
    );
    expect(pathFor(custom, "A1").attributes("d")).not.toContain("NaN");
  });

  it("falls back to Mercator, with a warning, when the projection cannot place the regions", () => {
    const warn = warnSpy();
    const albers = mountZones({ projection: "albersUsa" });
    expect(pathFor(albers, "A1").attributes("d")).toBe(
      pathFor(mountZones(), "A1").attributes("d"),
    );
    expect(
      warn.mock.calls.filter(([m]) => String(m).includes("falling back")),
    ).toHaveLength(1);
  });

  it("warns once that US-only props are ignored alongside regions", () => {
    const warn = warnSpy();
    mountZones({
      topology: statesTopo,
      stateLabels: true,
      geoType: "counties",
      enlargeDc: false,
    });
    const ignored = warn.mock.calls.filter(([m]) =>
      String(m).includes("US-only props are ignored"),
    );
    expect(ignored).toHaveLength(1);
    expect(ignored[0][0]).toContain("topology");
    expect(ignored[0][0]).toContain("stateLabels");
    expect(ignored[0][0]).toContain("geoType");
    // `false` is the no-op value, not an ignored setting.
    expect(ignored[0][0]).not.toContain("enlargeDc");
  });

  it("never paints the US topology's meshes under custom regions", () => {
    warnSpy();
    const wrapper = mountZones({
      topology: countiesTopo,
      theme: { countyBorders: "#f00", hsaBorders: "#0f0", outline: "#00f" },
      stateLabels: true,
      cities: [{ name: "Nowhere", coordinates: [0, 0] }],
    });
    expect(wrapper.find(".choropleth-county-borders").exists()).toBe(false);
    expect(wrapper.find(".choropleth-hsa-borders").exists()).toBe(false);
    expect(wrapper.find(".choropleth-outline").exists()).toBe(false);
    expect(wrapper.find(".choropleth-city-overlay").exists()).toBe(false);
    expect(wrapper.findAll(".state-path")).toHaveLength(6);
  });

  it("does not rebuild when a new `regions` object carries the same content", async () => {
    const wrapper = mountZones();
    const before = pathFor(wrapper, "A1").element;
    await wrapper.setProps({ regions: { ...zoneRegions } });
    expect(pathFor(wrapper, "A1").element).toBe(before);
    await wrapper.setProps({
      regions: { ...zoneRegions, idProperty: "label" },
    });
    expect(pathFor(wrapper, "Zone A1").exists()).toBe(true);
  });

  it("warns when neither topology nor regions is given", () => {
    const warn = warnSpy();
    const wrapper = mount(ChoroplethMap, {
      props: { width: 600, height: 400 },
    });
    expect(
      warn.mock.calls.some(([m]) => String(m).includes("nothing to draw")),
    ).toBe(true);
    expect(wrapper.findAll(".state-path")).toHaveLength(0);
  });

  it("passes the original properties to the tooltip slot", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { regions: zoneRegions, data: [{ id: "A3", value: 9 }] },
      slots: {
        tooltip: `<template #tooltip="{ name, value, feature }">
          <span class="tip">{{ name }}|{{ value }}|{{ feature.properties.district }}</span>
        </template>`,
      },
    });
    // The slot switches to the interactive tooltip, dropping the native title.
    expect(pathFor(wrapper, "A3").find("title").exists()).toBe(false);
    await pathFor(wrapper, "A3").trigger("mouseover");
    expect(document.querySelector(".tip")?.textContent).toBe("Zone A3|9|east");
    wrapper.unmount();
  });

  it("switches between US and custom geography at runtime", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: { topology: statesTopo, width: 600, height: 400 },
    });
    expect(wrapper.findAll(".state-path").length).toBeGreaterThanOrEqual(50);
    await wrapper.setProps({ regions: zoneRegions });
    expect(wrapper.findAll(".state-path")).toHaveLength(6);
    await wrapper.setProps({ regions: undefined });
    expect(wrapper.findAll(".state-path").length).toBeGreaterThanOrEqual(50);
  });
});
