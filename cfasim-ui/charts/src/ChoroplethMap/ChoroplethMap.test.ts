import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import type { Topology } from "topojson-specification";
import ChoroplethMap from "./ChoroplethMap.vue";
import {
  autoUnmount,
  finishZoomAnimation,
  flushOverlayLayout,
  flushFrame,
  statesTopo,
  countyFixtureTopo,
  hsaTopo,
  strokeStyle,
  pathFor,
  hsaMapping,
} from "./ChoroplethMap.testUtils.js";

vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

const baseProps = { topology: statesTopo, width: 600, height: 400 };

describe("ChoroplethMap rendering and scales", () => {
  it("renders states and colors by FIPS, name, continuous domain, and clamping", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        data: [
          { id: "06", value: 250 },
          { id: "New York", value: -10 },
          { id: "48", value: 50 },
        ],
        colorScale: { min: "#000000", max: "#ffffff", domain: [0, 100] },
      },
    });
    expect(wrapper.findAll(".state-path").length).toBeGreaterThanOrEqual(50);
    expect(pathFor(wrapper, "06").attributes("fill")).toBe("rgb(255,255,255)");
    expect(pathFor(wrapper, "36").attributes("fill")).toBe("rgb(0,0,0)");
    expect(pathFor(wrapper, "48").attributes("fill")).toBe("rgb(128,128,128)");
    expect(wrapper.find(".choropleth-legend-gradient").exists()).toBe(true);
    expect(
      wrapper.findAll(".choropleth-legend-ticks > span").map((el) => el.text()),
    ).toEqual(["25", "50", "75"]);
  });

  it("applies threshold and categorical scales with per-stop styling and legends", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        data: [
          { id: "06", value: 80 },
          { id: "36", value: 5 },
        ],
        colorScale: [
          { min: 50, color: "#red1", label: "High" },
          { min: 10, color: "#yellow1", label: "Med" },
        ],
      },
    });
    expect(pathFor(wrapper, "06").attributes("fill")).toBe("#red1");
    expect(pathFor(wrapper, "36").attributes("fill")).toBe("#ddd");
    expect(
      wrapper.findAll(".choropleth-legend-item").map((el) => el.text()),
    ).toEqual(["Med", "High"]);

    await wrapper.setProps({
      data: [
        { id: "06", value: "high" },
        { id: "36", value: "unknown" },
      ],
      colorScale: [
        { value: "low", color: "#green1" },
        { value: "high", color: "#red1", stroke: "#red2", highlight: "#red3" },
      ],
    });
    const california = pathFor(wrapper, "06");
    expect(california.attributes("fill")).toBe("#red1");
    expect(california.attributes("stroke")).toBe("#red2");
    expect(pathFor(wrapper, "36").attributes("fill")).toBe("#ddd");
    await california.trigger("mouseover");
    expect(strokeStyle(california)).toBe("#red3");
  });

  it("warns on unplaced territory under albersUsa and draws it under albersUsaTerritories", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(ChoroplethMap, {
      props: { ...baseProps, data: [{ id: "72", value: 2 }] },
    });
    expect(
      warn.mock.calls.filter(([msg]) => String(msg).includes("cannot place")),
    ).toHaveLength(1);
    expect(pathFor(wrapper, "72").attributes("d") ?? "").toBe("");

    await wrapper.setProps({ projection: "albersUsaTerritories" });
    const prPath = pathFor(wrapper, "72").attributes("d") ?? "";
    expect(prPath).toMatch(/^M[\d.]+,[\d.]+/);
    expect(prPath).not.toContain("NaN");
    warn.mockRestore();
  });
});

describe("ChoroplethMap geography modes", () => {
  it("renders counties, supports dataGeoType lookup, and scopes to single state", () => {
    const national = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        topology: countyFixtureTopo,
        geoType: "counties",
        dataGeoType: "states",
        data: [{ id: "California", value: 99 }],
      },
    });
    expect(national.find(".choropleth-state-borders").exists()).toBe(true);
    expect(pathFor(national, "06037").attributes("fill")).not.toBe("#ddd");
    expect(pathFor(national, "36061").attributes("fill")).toBe("#ddd");

    const scoped = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        topology: countyFixtureTopo,
        geoType: "counties",
        state: "California",
      },
    });
    const paths = scoped.findAll(".state-path");
    expect(paths).toHaveLength(58);
    expect(
      paths.every((el) => el.attributes("data-feat-id")!.startsWith("06")),
    ).toBe(true);

    // Puerto Rico falls back to Mercator without NaN paths.
    const pr = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        topology: countyFixtureTopo,
        geoType: "counties",
        state: "Puerto Rico",
      },
    });
    expect(pr.findAll("path").length).toBeGreaterThan(0);
    for (const el of pr.findAll("path")) {
      expect(el.attributes("d") ?? "").not.toContain("NaN");
    }
  });

  it("defers HSA rendering until hsaMapping arrives and supports pre-merged hsaTopo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(ChoroplethMap, {
      props: { ...baseProps, topology: countyFixtureTopo, geoType: "hsas" },
    });
    expect(wrapper.find(".choropleth-wrapper").attributes("aria-busy")).toBe(
      "true",
    );
    expect(wrapper.findAll(".state-path")).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ hsaMapping });
    warn.mockRestore();
    expect(
      wrapper.find(".choropleth-wrapper").attributes("aria-busy"),
    ).toBeUndefined();
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(50);

    const premerged = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        hsaMapping,
        topology: hsaTopo,
        geoType: "hsas",
        data: [{ id: "010259", value: 100 }],
      },
    });
    expect(premerged.findAll(".state-path").length).toBeGreaterThan(900);
    const butler = pathFor(premerged, "010259");
    expect(butler.find("title").text()).toContain("Butler, AL");
    expect(butler.attributes("fill")).not.toBe("#ddd");
  });

  it("mixes geographic levels per data row and re-mixes reactively", async () => {
    const ids = (wrapper: ReturnType<typeof mount>) =>
      wrapper
        .findAll(".state-path")
        .map((el) => el.attributes("data-feat-id")!);

    const wrapper = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        topology: countyFixtureTopo,
        geoType: "counties",
        data: [
          { id: "36061", value: 10 },
          { id: "06", value: 90, geoType: "states" },
        ],
      },
    });
    expect(ids(wrapper)).toContain("06");
    expect(ids(wrapper).some((id) => /^06\d{3}$/.test(id))).toBe(false);
    expect(ids(wrapper)).toContain("36061");
    expect(pathFor(wrapper, "06").find("title").text()).toBe("California: 90");

    // Value-only update preserves DOM nodes; dropping geoType restores counties.
    const stateEl = pathFor(wrapper, "06").element;
    await wrapper.setProps({
      data: [{ id: "06", value: 50, geoType: "states" }],
    });
    expect(pathFor(wrapper, "06").element).toBe(stateEl);

    await wrapper.setProps({ data: [{ id: "06037", value: 50 }] });
    expect(ids(wrapper)).not.toContain("06");
    expect(ids(wrapper)).toContain("06037");
  });

  it("renders custom GeoJSON and TopoJSON regions with custom borders", () => {
    const square = (x0: number): GeoJSON.Polygon => ({
      type: "Polygon",
      coordinates: [
        [
          [x0, 0],
          [x0 + 10, 0],
          [x0 + 10, 10],
          [x0, 10],
          [x0, 0],
        ],
      ],
    });
    const zones: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { code: "A1", label: "Zone A1" },
          geometry: square(0),
        },
        {
          type: "Feature",
          properties: { code: "A2", label: "Zone A2" },
          geometry: square(10),
        },
      ],
    };
    const wrapper = mount(ChoroplethMap, {
      props: {
        regions: {
          geojson: zones,
          idProperty: "code",
          nameProperty: "label",
          borders: { geojson: zones },
        },
        data: [{ id: "Zone A1", value: 5 }],
        theme: { borders: "#123456" },
        width: 600,
        height: 400,
      },
    });
    expect(wrapper.findAll(".state-path")).toHaveLength(2);
    expect(pathFor(wrapper, "A1").attributes("aria-label")).toBe("Zone A1: 5");
    expect(pathFor(wrapper, "A1").attributes("fill")).not.toBe("#ddd");
    expect(wrapper.find(".choropleth-state-borders").attributes("stroke")).toBe(
      "#123456",
    );

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
    const topoWrapper = mount(ChoroplethMap, {
      props: {
        regions: { topology: pairTopo, borders: { object: "zones" } },
        theme: { outline: "#0a0" },
        width: 600,
        height: 400,
      },
    });
    expect(topoWrapper.find(".choropleth-outline").exists()).toBe(true);
    expect(
      topoWrapper.find(".choropleth-state-borders").attributes("d"),
    ).toMatch(/^M[^ML]+L[^ML]+$/);
  });
});

describe("ChoroplethMap theming, borders, and overlays", () => {
  it("applies theme channels, border meshes, and countyBordersMinZoom", async () => {
    const themed = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        theme: {
          fill: "#eee",
          stroke: "#333",
          outline: "#0a0",
          background: "#123",
        },
      },
    });
    expect(themed.find(".state-path").attributes("fill")).toBe("#eee");
    expect(themed.find(".state-path").attributes("stroke")).toBe("#333");
    expect(themed.find(".choropleth-outline").attributes("stroke")).toBe(
      "#0a0",
    );
    expect(
      themed.find("rect.choropleth-map-background").attributes("fill"),
    ).toBe("#123");
    await themed.setProps({ theme: {} });
    expect(themed.find(".choropleth-outline").exists()).toBe(false);
    expect(themed.find("rect.choropleth-map-background").exists()).toBe(false);

    const hsaMap = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        hsaMapping,
        topology: countyFixtureTopo,
        geoType: "hsas",
        zoom: true,
        countyBordersMinZoom: 2,
        theme: { countyBorders: "#999" },
      },
    });
    const countyMesh = hsaMap.find(".choropleth-county-borders");
    expect(countyMesh.attributes("stroke")).toBe("#999");
    expect(countyMesh.attributes("display")).toBe("none");

    const countyMap = mount(ChoroplethMap, {
      props: {
        ...baseProps,
        hsaMapping,
        topology: countyFixtureTopo,
        geoType: "counties",
        theme: { hsaBorders: "#eee" },
      },
    });
    expect(countyMap.find(".choropleth-hsa-borders").attributes("stroke")).toBe(
      "#eee",
    );
  });

  it("renders city overlay with minZoom filtering and stateLabels with hit proxies", async () => {
    const cities = [
      {
        name: "Austin",
        coordinates: [-97.75, 30.28] as [number, number],
        capital: true,
        minZoom: 1,
      },
      {
        name: "Houston",
        coordinates: [-95.36, 29.76] as [number, number],
        minZoom: 5,
      },
    ];
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: statesTopo,
        width: 800,
        height: 500,
        cities,
        zoom: true,
        stateLabels: true,
        tooltipTrigger: "hover",
        colorScale: { min: "#ffffff", max: "#000000" },
        data: [
          { id: "06", value: 100 },
          { id: "36", value: 0 },
          { id: "44", value: 7 },
        ],
      },
    });
    await flushOverlayLayout();

    const cityLayer = wrapper.find(".choropleth-city-overlay").element;
    expect(cityLayer.querySelectorAll(".choropleth-city-dot")).toHaveLength(1);
    expect(
      cityLayer.querySelector(".choropleth-city-label-capital")?.textContent,
    ).toBe("Austin");

    const labelLayer = wrapper.find(".choropleth-state-labels").element;
    const labels = [
      ...labelLayer.querySelectorAll<SVGTextElement>(".choropleth-state-label"),
    ];
    expect(labels.length).toBeGreaterThanOrEqual(50);
    expect(labels.find((el) => el.textContent === "CA")!.style.fill).toContain(
      "--choropleth-state-label-light",
    );
    expect(labels.find((el) => el.textContent === "NY")!.style.fill).toContain(
      "--choropleth-state-label-dark",
    );
    expect(
      labelLayer.querySelector('.choropleth-state-leader[data-state="11"]'),
    ).not.toBeNull();

    const riHit = labelLayer.querySelector(
      '.choropleth-state-label-hit[data-feat-id="44"]',
    )!;
    riHit.dispatchEvent(
      new MouseEvent("mouseover", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(wrapper.emitted("stateHover")!.at(-1)![0]).toMatchObject({
      id: "44",
    });
    vi.useFakeTimers();
    try {
      riHit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.advanceTimersByTime(300);
    } finally {
      vi.useRealTimers();
    }
    expect(wrapper.emitted("stateClick")!.at(-1)![0]).toMatchObject({
      id: "44",
    });
  });

  it("enlarges DC by default on state maps and restores true size when zoomed in", async () => {
    const plain = mount(ChoroplethMap, {
      props: { ...baseProps, enlargeDc: false },
    });
    const wrapper = mount(ChoroplethMap, {
      props: { ...baseProps, zoom: true, enlargeDc: 2 },
    });
    const plainDc = pathFor(plain, "11").attributes("d")!;
    expect(pathFor(wrapper, "11").attributes("d")).not.toBe(plainDc);

    await wrapper.setProps({ focus: "24" });
    await flushPromises();
    await finishZoomAnimation();
    await flushPromises();
    expect(pathFor(wrapper, "11").attributes("d")).toBe(plainDc);
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
        constructor(public d?: string) {}
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
      drawImage: vi.fn(),
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

  it("draws scene, picks hover/click, blits on hover, and switches to svg at runtime", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        ...baseProps,
        renderer: "canvas",
        zoom: false,
        tooltipTrigger: "hover",
        data: [{ id: "06", value: 42 }],
      },
    });
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(true);
    expect(wrapper.findAll(".state-path")).toHaveLength(0);
    await flushFrame();
    expect(drawCtx.fill.mock.calls.length).toBeGreaterThanOrEqual(50);

    const surface = wrapper.find(".choropleth-wrapper > svg").element;
    const fillsBefore = drawCtx.fill.mock.calls.length;
    pickColor = [0, 0, 1, 255];
    surface.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    await flushFrame();
    expect(wrapper.emitted("stateHover")).toHaveLength(1);
    expect(drawCtx.drawImage.mock.calls.length).toBeGreaterThan(0);
    expect(drawCtx.fill.mock.calls.length - fillsBefore).toBeLessThan(5);

    surface.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 100, clientY: 100 }),
    );
    expect(wrapper.emitted("stateClick")).toHaveLength(1);

    await wrapper.setProps({ renderer: "svg" });
    await flushFrame();
    expect(wrapper.find("canvas.choropleth-canvas").exists()).toBe(false);
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(50);
  });
});
