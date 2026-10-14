import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { Topology } from "topojson-specification";
import ChoroplethMap from "./ChoroplethMap.vue";
import {
  autoUnmount,
  countiesTopo,
  hsaTopo,
  flushDynamicImports,
} from "./ChoroplethMap.testUtils.js";

// Touch detection is probed per event, so tests can flip devices per case.
// happy-dom defaults to a mouse-only environment.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

describe("ChoroplethMap county borders (theme.countyBorders)", () => {
  const countyMesh = (wrapper: ReturnType<typeof mount>) =>
    wrapper.find(".choropleth-county-borders");

  it("draws the county mesh on an HSA map once the lazy module resolves", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        width: 600,
        height: 400,
        theme: { countyBorders: "#999" },
      },
    });
    // Pre-module: no features and no FIPS→HSA table, so no mesh yet.
    expect(countyMesh(wrapper).exists()).toBe(false);
    await flushDynamicImports();
    const mesh = countyMesh(wrapper);
    expect(mesh.exists()).toBe(true);
    expect(mesh.attributes("stroke")).toBe("#999");
    expect(mesh.attributes("fill")).toBe("none");
    expect(mesh.attributes("pointer-events")).toBe("none");
    expect(mesh.attributes("d")).toBeTruthy();
    expect(mesh.attributes("d")).not.toContain("NaN");
  });

  it("keeps the mesh below the state-borders mesh and the outline", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        width: 600,
        height: 400,
        theme: { countyBorders: "#999", borders: "#900", outline: "#0a0" },
      },
    });
    await flushDynamicImports();
    const county = countyMesh(wrapper).element;
    const stateMesh = wrapper
      .find(".choropleth-wrapper > svg")
      .findAll("path")
      .find(
        (p) =>
          p.attributes("fill") === "none" &&
          !p.classes("choropleth-county-borders") &&
          !p.classes("choropleth-outline") &&
          !p.classes("focus-overlay"),
      )!.element;
    const outline = wrapper.find(".choropleth-outline").element;
    expect(
      county.compareDocumentPosition(stateMesh) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      county.compareDocumentPosition(outline) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("defaults the mesh width to the feature stroke width", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        width: 600,
        height: 400,
        theme: { countyBorders: "#999" },
      },
    });
    await flushDynamicImports();
    // Dense-map feature stroke default is 0.25.
    expect(countyMesh(wrapper).attributes("stroke-width")).toBe("0.25");
    await wrapper.setProps({
      theme: { countyBorders: "#999", countyBordersWidth: 1 },
    });
    expect(countyMesh(wrapper).attributes("stroke-width")).toBe("1");
  });

  it("scopes the mesh to the selected state in single-state mode", async () => {
    const national = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        width: 600,
        height: 400,
        theme: { countyBorders: "#999" },
      },
    });
    const scoped = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        state: "California",
        width: 600,
        height: 400,
        theme: { countyBorders: "#999" },
      },
    });
    await flushDynamicImports();
    const nationalD = countyMesh(national).attributes("d")!;
    const scopedD = countyMesh(scoped).attributes("d")!;
    expect(scopedD).toBeTruthy();
    expect(scopedD.length).toBeLessThan(nationalD.length / 4);
  });

  it("draws county texture on a states-level map without the HSA module", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        theme: { countyBorders: "#999" },
      },
    });
    expect(countyMesh(wrapper).exists()).toBe(true);
  });

  it("draws nothing on county maps, where feature strokes are the county lines", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        theme: { countyBorders: "#999" },
      },
    });
    expect(countyMesh(wrapper).exists()).toBe(false);
  });

  it("draws nothing from a pre-merged HSA topology (no counties object)", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: hsaTopo as unknown as Topology,
        geoType: "hsas" as const,
        width: 600,
        height: 400,
        theme: { countyBorders: "#999" },
      },
    });
    await flushDynamicImports();
    expect(wrapper.findAll(".state-path").length).toBeGreaterThan(0);
    expect(countyMesh(wrapper).exists()).toBe(false);
  });

  it("renders no county mesh by default and removes it when the theme drops it", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
      },
    });
    expect(countyMesh(wrapper).exists()).toBe(false);
    await wrapper.setProps({ theme: { countyBorders: "#999" } });
    expect(countyMesh(wrapper).exists()).toBe(true);
    await wrapper.setProps({ theme: {} });
    expect(countyMesh(wrapper).exists()).toBe(false);
  });

  it("hides the mesh below countyBordersMinZoom while zoom is enabled", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        zoom: true,
        countyBordersMinZoom: 2,
        theme: { countyBorders: "#999" },
      },
    });
    const mesh = countyMesh(wrapper);
    expect(mesh.exists()).toBe(true);
    expect(mesh.attributes("display")).toBe("none");
  });

  it("ignores countyBordersMinZoom on a static map", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        countyBordersMinZoom: 2,
        theme: { countyBorders: "#999" },
      },
    });
    expect(countyMesh(wrapper).attributes("display")).toBeUndefined();
  });

  it("leaves a state re-tiled through data[].geoType unruled", async () => {
    const props = {
      topology: countiesTopo,
      geoType: "hsas" as const,
      width: 600,
      height: 400,
      theme: { countyBorders: "#999" },
    };
    const base = mount(ChoroplethMap, { props });
    const mixed = mount(ChoroplethMap, {
      props: {
        ...props,
        data: [{ id: "06", value: 1, geoType: "states" as const }],
      },
    });
    await flushDynamicImports();
    const baseD = countyMesh(base).attributes("d")!;
    const mixedD = countyMesh(mixed).attributes("d")!;
    expect(mixedD).toBeTruthy();
    expect(mixedD.length).toBeLessThan(baseD.length);
  });

  it("draws no mesh at all over a single state merged to its state shape", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        state: "California",
        width: 600,
        height: 400,
        data: [{ id: "06", value: 1, geoType: "states" as const }],
        theme: { countyBorders: "#999" },
      },
    });
    await flushDynamicImports();
    expect(countyMesh(wrapper).exists()).toBe(false);
  });
});

describe("ChoroplethMap HSA borders (theme.hsaBorders)", () => {
  const hsaMesh = (wrapper: ReturnType<typeof mount>) =>
    wrapper.find(".choropleth-hsa-borders");

  it("draws HSA separators on a county map, loading the lazy table itself", async () => {
    // Nothing else on this map is HSA-shaped: the theme key alone must
    // trigger the FIPS→HSA module load.
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        theme: { hsaBorders: "#eee" },
      },
    });
    expect(hsaMesh(wrapper).exists()).toBe(false);
    await flushDynamicImports();
    const mesh = hsaMesh(wrapper);
    expect(mesh.exists()).toBe(true);
    expect(mesh.attributes("stroke")).toBe("#eee");
    expect(mesh.attributes("fill")).toBe("none");
    expect(mesh.attributes("pointer-events")).toBe("none");
    expect(mesh.attributes("d")).toBeTruthy();
    expect(mesh.attributes("d")).not.toContain("NaN");
    // Default width follows the dense-map feature stroke (0.25).
    expect(mesh.attributes("stroke-width")).toBe("0.25");
  });

  it("keeps the mesh above county features and below the state mesh", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        theme: { hsaBorders: "#eee", borders: "#900" },
      },
    });
    await flushDynamicImports();
    const mesh = hsaMesh(wrapper).element;
    const feature = wrapper.find(".state-path").element;
    const stateMesh = wrapper
      .find(".choropleth-wrapper > svg")
      .findAll("path")
      .find(
        (p) =>
          p.attributes("fill") === "none" &&
          !p.classes("choropleth-hsa-borders") &&
          !p.classes("choropleth-county-borders") &&
          !p.classes("choropleth-outline") &&
          !p.classes("focus-overlay"),
      )!.element;
    expect(
      feature.compareDocumentPosition(mesh) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      mesh.compareDocumentPosition(stateMesh) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("draws nothing on HSA maps, where feature strokes are the HSA lines", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "hsas" as const,
        width: 600,
        height: 400,
        theme: { hsaBorders: "#eee" },
      },
    });
    await flushDynamicImports();
    expect(hsaMesh(wrapper).exists()).toBe(false);
  });

  it("removes the mesh when the theme drops it", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        theme: { hsaBorders: "#eee" },
      },
    });
    await flushDynamicImports();
    expect(hsaMesh(wrapper).exists()).toBe(true);
    await wrapper.setProps({ theme: {} });
    expect(hsaMesh(wrapper).exists()).toBe(false);
  });

  it("scopes the mesh to the selected state in single-state mode", async () => {
    const national = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        theme: { hsaBorders: "#eee" },
      },
    });
    const scoped = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        state: "California",
        width: 600,
        height: 400,
        theme: { hsaBorders: "#eee" },
      },
    });
    await flushDynamicImports();
    const nationalD = hsaMesh(national).attributes("d")!;
    const scopedD = hsaMesh(scoped).attributes("d")!;
    expect(scopedD).toBeTruthy();
    expect(scopedD.length).toBeLessThan(nationalD.length / 4);
  });

  it("leaves a state re-tiled to one state-level shape unruled", async () => {
    // The mixed-view default: a county-interactive map (dataGeoType: "hsas")
    // where one state reports a single state-level estimate must not get HSA
    // separators drawn inside its merged shape.
    const props = {
      topology: countiesTopo,
      geoType: "counties" as const,
      dataGeoType: "hsas" as const,
      width: 600,
      height: 400,
      theme: { hsaBorders: "#eee" },
    };
    const base = mount(ChoroplethMap, { props });
    const mixed = mount(ChoroplethMap, {
      props: {
        ...props,
        data: [{ id: "06", value: 1, geoType: "states" as const }],
      },
    });
    await flushDynamicImports();
    const baseD = hsaMesh(base).attributes("d")!;
    const mixedD = hsaMesh(mixed).attributes("d")!;
    expect(mixedD).toBeTruthy();
    expect(mixedD.length).toBeLessThan(baseD.length);
  });
});
