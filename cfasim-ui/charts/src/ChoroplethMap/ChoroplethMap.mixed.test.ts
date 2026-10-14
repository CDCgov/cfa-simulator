import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ChoroplethMap from "./ChoroplethMap.vue";
import {
  autoUnmount,
  statesTopo,
  countiesTopo,
  hsaTopo,
  flushDynamicImports,
  strokeStyle,
  clickSelect,
} from "./ChoroplethMap.testUtils.js";

// Touch detection is probed per event, so tests can flip devices per case.
// happy-dom defaults to a mouse-only environment.
vi.mock("../_shared/touch.js", () => ({
  isTouchDevice: vi.fn(() => false),
}));

autoUnmount();

describe("ChoroplethMap mixed geographic levels", () => {
  const ids = (wrapper: {
    findAll: (s: string) => { attributes: (a: string) => string | undefined }[];
  }) =>
    wrapper.findAll(".state-path").map((p) => p.attributes("data-feat-id")!);

  it("draws a state-level row as one merged shape on a county map", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [
          { id: "36061", value: 10 },
          { id: "06", value: 90, geoType: "states" as const },
        ],
      },
    });
    const rendered = ids(wrapper);
    // California collapses to a single feature; its counties are gone.
    expect(rendered).toContain("06");
    expect(rendered.filter((id) => id.startsWith("06") && id !== "06")).toEqual(
      [],
    );
    // Every other state still renders as counties.
    expect(rendered).toContain("36061");
    expect(rendered.filter((id) => id.startsWith("36")).length).toBeGreaterThan(
      1,
    );
    wrapper.unmount();
  });

  it("colors the merged state from its own row", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        colorScale: { min: "#ffffff", max: "#ff0000" },
        data: [
          { id: "36061", value: 0 },
          { id: "06", value: 100, geoType: "states" as const },
        ],
      },
    });
    const path = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(path.attributes("fill")).toBe("rgb(255,0,0)");
    wrapper.unmount();
  });

  it("names the merged state in the tooltip payload", async () => {
    const wrapper = mount(ChoroplethMap, {
      attachTo: document.body,
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 42, geoType: "states" as const }],
      },
      slots: {
        tooltip: `<template #tooltip="{ name, value }">
          <div class="mixed-tip">{{ name }} :: {{ value }}</div>
        </template>`,
      },
    });
    const california = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    await california.trigger("mouseover");
    await flushPromises();
    expect(document.body.querySelector(".mixed-tip")!.textContent).toContain(
      "California :: 42",
    );
    // Hover emits carry the state, not a county.
    expect(wrapper.emitted("stateHover")![0][0]).toMatchObject({
      id: "06",
      name: "California",
      value: 42,
    });
    wrapper.unmount();
  });

  it("falls back to the <title> for a merged state with no interactive tooltip", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 42, geoType: "states" as const }],
      },
    });
    const path = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(path.find("title").text()).toBe("California: 42");
    wrapper.unmount();
  });

  it("applies per-stop strokes and highlights to mixed-level features", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 80, geoType: "states" as const }],
        colorScale: [
          { min: 0, color: "#fff", stroke: "#ccc" },
          {
            min: 60,
            color: "#6d085a",
            stroke: "#3d0032",
            highlight: "#fff",
          },
        ],
        theme: { stroke: "#aaa" },
      },
    });
    const merged = wrapper.find('.state-path[data-feat-id="06"]');
    const noData = wrapper.find('.state-path[data-feat-id="36061"]');
    expect(merged.attributes("fill")).toBe("#6d085a");
    expect(merged.attributes("stroke")).toBe("#3d0032");
    expect(noData.attributes("stroke")).toBe("#aaa");
    await merged.trigger("mouseover");
    expect(strokeStyle(merged)).toBe("#fff");
    wrapper.unmount();
  });

  it("splits one state into counties on a state map", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "states" as const,
        width: 600,
        height: 400,
        data: [{ id: "36061", value: 5, geoType: "counties" as const }],
      },
    });
    const rendered = ids(wrapper);
    expect(rendered).not.toContain("36");
    expect(rendered).toContain("36061");
    // 62 New York counties replace the one state feature.
    expect(rendered.filter((id) => id.startsWith("36")).length).toBe(62);
    // Other states stay whole.
    expect(rendered).toContain("06");
    // Counties without a row of their own read as no-data.
    const sibling = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "36047")!;
    expect(sibling.attributes("fill")).toBe("#ddd");
    wrapper.unmount();
  });

  it("resolves an off-level row by feature name", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [{ id: "California", value: 7, geoType: "states" as const }],
      },
    });
    const path = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    expect(path).toBeDefined();
    expect(path.attributes("fill")).not.toBe("#ddd");
    wrapper.unmount();
  });

  it("looks an off-level row up by its own id, ignoring dataGeoType", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        // Base counties read their value from their parent state...
        dataGeoType: "states" as const,
        width: 600,
        height: 400,
        data: [
          { id: "36", value: 10 },
          // ...while this row is keyed at its own level.
          { id: "06", value: 90, geoType: "states" as const },
        ],
      },
    });
    const merged = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!;
    const nyCounty = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "36061")!;
    expect(merged.attributes("fill")).not.toBe("#ddd");
    expect(nyCounty.attributes("fill")).not.toBe("#ddd");
    expect(merged.attributes("fill")).not.toBe(nyCounty.attributes("fill"));
    wrapper.unmount();
  });

  it("substitutes HSAs for one state once the mapping loads", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        // HSA 060723 is in California.
        data: [{ id: "060723", value: 3, geoType: "hsas" as const }],
      },
    });
    await flushDynamicImports();
    const rendered = ids(wrapper);
    expect(rendered).toContain("060723");
    expect(rendered.some((id) => /^06\d{3}$/.test(id))).toBe(false);
    expect(rendered).toContain("36061");
    wrapper.unmount();
  });

  it("keeps the feature tree when only values change", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 1, geoType: "states" as const }],
      },
    });
    const before = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!.element;
    await wrapper.setProps({
      data: [{ id: "06", value: 2, geoType: "states" as const }],
    });
    const after = wrapper
      .findAll(".state-path")
      .find((p) => p.attributes("data-feat-id") === "06")!.element;
    // Same element: a value update repaints, it doesn't rebuild the map.
    expect(after).toBe(before);
    wrapper.unmount();
  });

  it("re-mixes when a row's geoType changes", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [{ id: "06", value: 1, geoType: "states" as const }],
      },
    });
    expect(ids(wrapper)).toContain("06");
    await wrapper.setProps({ data: [{ id: "06037", value: 1 }] });
    const rendered = ids(wrapper);
    expect(rendered).not.toContain("06");
    expect(rendered).toContain("06037");
    wrapper.unmount();
  });

  it("warns and renders the plain base map for an unresolvable row", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        geoType: "counties" as const,
        width: 600,
        height: 400,
        data: [{ id: "Atlantis", value: 1, geoType: "states" as const }],
      },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Atlantis"));
    expect(ids(wrapper)).toContain("06037");
    warn.mockRestore();
    wrapper.unmount();
  });
});

describe("ChoroplethMap pre-merged HSA topology (objects.hsas fast path)", () => {
  // Feature id → rendered path data. The fast path must reproduce the runtime
  // county merge exactly, so path `d` strings are compared verbatim.
  const pathsById = (wrapper: {
    findAll: (s: string) => { attributes: (a: string) => string | undefined }[];
  }) => {
    const m = new Map<string, string | undefined>();
    for (const p of wrapper.findAll(".state-path")) {
      m.set(p.attributes("data-feat-id")!, p.attributes("d"));
    }
    return m;
  };

  async function mountHsas(extra: Record<string, unknown> = {}) {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: hsaTopo,
        width: 600,
        height: 400,
        geoType: "hsas" as const,
        ...extra,
      },
    });
    await flushDynamicImports();
    return wrapper;
  }

  it("renders identically to the runtime merge from a counties topology", async () => {
    const fast = await mountHsas();
    const legacy = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "hsas" as const,
      },
    });
    await flushDynamicImports();
    const fastPaths = pathsById(fast);
    const legacyPaths = pathsById(legacy);
    expect(fastPaths.size).toBeGreaterThan(900);
    expect(fastPaths).toEqual(legacyPaths);
    fast.unmount();
    legacy.unmount();
  });

  it("scopes to a single state by HSA-code prefix", async () => {
    const fast = await mountHsas({ state: "06" });
    const legacy = mount(ChoroplethMap, {
      props: {
        topology: countiesTopo,
        width: 600,
        height: 400,
        geoType: "hsas" as const,
        state: "06",
      },
    });
    await flushDynamicImports();
    const fastPaths = pathsById(fast);
    expect(fastPaths.size).toBeGreaterThan(10);
    for (const id of fastPaths.keys()) expect(id.slice(0, 2)).toBe("06");
    expect(fastPaths).toEqual(pathsById(legacy));
    fast.unmount();
    legacy.unmount();
  });

  it("labels and colors HSAs via the lazy hsaNames table", async () => {
    const wrapper = await mountHsas({
      data: [{ id: "010259", value: 100 }],
    });
    const butler = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("Butler, AL"));
    expect(butler).toBeDefined();
    expect(butler!.attributes("fill")).not.toBe("#ddd");
    wrapper.unmount();
  });

  it("draws a state-level row as one merged shape (mixed levels)", async () => {
    const wrapper = await mountHsas({
      data: [{ id: "06", value: 90, geoType: "states" as const }],
    });
    const rendered = [...pathsById(wrapper).keys()];
    expect(rendered).toContain("06");
    // California's HSAs are replaced by the single state feature.
    expect(rendered.filter((id) => id.startsWith("06") && id !== "06")).toEqual(
      [],
    );
    // Other states still render as HSAs.
    expect(rendered.filter((id) => id.startsWith("01")).length).toBeGreaterThan(
      1,
    );
    wrapper.unmount();
  });

  it("does not outline a states-only topology in hsas mode", async () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        topology: statesTopo,
        width: 600,
        height: 400,
        geoType: "hsas" as const,
        theme: { outline: "#0a0" },
      },
    });
    await flushDynamicImports();
    expect(wrapper.find(".choropleth-outline").exists()).toBe(false);
    wrapper.unmount();
  });

  it("renders state borders and the exterior outline without a counties object", async () => {
    const wrapper = await mountHsas({ theme: { outline: "#0a0" } });
    const borderPath = wrapper
      .findAll("path")
      .find(
        (p) =>
          p.attributes("fill") === "none" &&
          p.attributes("pointer-events") === "none" &&
          !p.classes("choropleth-outline"),
      );
    expect(borderPath).toBeDefined();
    expect(wrapper.find(".choropleth-outline").exists()).toBe(true);
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
