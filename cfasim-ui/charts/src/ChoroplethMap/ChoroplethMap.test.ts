import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChoroplethMap from "./ChoroplethMap.vue";

describe("ChoroplethMap", () => {
  it("renders SVG with state paths", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { width: 600, height: 400 },
    });
    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
    const paths = wrapper.findAll(".state-path");
    // us-atlas states-10m has 56 geometries (50 states + DC + territories)
    expect(paths.length).toBeGreaterThanOrEqual(50);
  });

  it("renders without data (all states default gray)", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { width: 600, height: 400 },
    });
    const paths = wrapper.findAll(".state-path");
    for (const path of paths) {
      expect(path.attributes("fill")).toBe("#ddd");
    }
  });

  it("colors states based on data by FIPS id", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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
      props: { width: 600, height: 400, title: "US Cases" },
    });
    const title = wrapper.find("svg > text");
    expect(title.text()).toBe("US Cases");
  });

  it("applies custom color scale", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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

  it("applies threshold color scale", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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
      props: { width: 600, height: 400 },
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

  it("renders categorical legend with circles and labels", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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
    const texts = legend.findAll("text");
    expect(texts[0].text()).toBe("Risk");
    expect(texts[1].text()).toBe("low");
    expect(texts[2].text()).toBe("high");
    const rects = legend.findAll("rect");
    expect(rects).toHaveLength(2);
  });

  it("renders threshold legend with circles and labels", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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
    const texts = legend.findAll("text");
    expect(texts[0].text()).toBe("Level");
    expect(texts[1].text()).toBe("Low");
    expect(texts[2].text()).toBe("High");
  });

  it("renders threshold legend with min values when no label", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        width: 600,
        height: 400,
        data: [{ id: "06", value: 50 }],
        colorScale: [
          { min: 0, color: "#aaa" },
          { min: 50, color: "#f00" },
        ],
      },
    });
    const legend = wrapper.find(".choropleth-legend");
    const texts = legend.findAll("text");
    expect(texts[0].text()).toBe("0");
    expect(texts[1].text()).toBe("50");
  });

  it("renders continuous legend with gradient rect and ticks", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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
    const texts = legend.findAll("text");
    expect(texts[0].text()).toBe("Severity");
    expect(legend.find("rect").exists()).toBe(true);
    expect(legend.find("linearGradient").exists()).toBe(true);
    // tick labels
    expect(texts.length).toBeGreaterThanOrEqual(3);
  });

  it("hides legend when legend=false", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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
      props: { width: 600, height: 400, geoType: "counties" },
    });
    const paths = wrapper.findAll(".state-path");
    // us-atlas counties-10m has 3231 county geometries
    expect(paths.length).toBeGreaterThanOrEqual(3000);
  });

  it("colors counties by FIPS id", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
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
      props: { width: 600, height: 400, geoType: "counties" },
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
      props: { width: 600, height: 400 },
    });
    const allPaths = wrapper.findAll("path");
    const borderPath = allPaths.find(
      (p) =>
        p.attributes("fill") === "none" &&
        p.attributes("pointer-events") === "none",
    );
    expect(borderPath).toBeUndefined();
  });

  it("renders HSA paths when geoType is hsas", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { width: 600, height: 400, geoType: "hsas" },
    });
    const paths = wrapper.findAll(".state-path");
    // 949 unique HSAs
    expect(paths.length).toBeGreaterThanOrEqual(900);
    expect(paths.length).toBeLessThan(1000);
  });

  it("colors HSAs by HSA code", () => {
    const wrapper = mount(ChoroplethMap, {
      props: {
        width: 600,
        height: 400,
        geoType: "hsas",
        data: [
          { id: "010259", value: 100 }, // Butler, AL
          { id: "010177", value: 0 }, // Calhoun (Anniston), AL
        ],
      },
    });
    const butler = wrapper
      .findAll(".state-path")
      .find((p) => p.find("title").text().includes("Butler, AL"));
    expect(butler).toBeDefined();
    expect(butler!.attributes("fill")).not.toBe("#ddd");
  });

  it("renders state borders overlay in HSA mode", () => {
    const wrapper = mount(ChoroplethMap, {
      props: { width: 600, height: 400, geoType: "hsas" },
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
      props: { width: 600, height: 400 },
    });
    const firstPath = wrapper.find(".state-path");
    await firstPath.trigger("mouseover");
    expect(wrapper.emitted("stateHover")).toHaveLength(1);
    expect(wrapper.emitted("stateHover")![0][0]).not.toBeNull();
    await firstPath.trigger("mouseout");
    expect(wrapper.emitted("stateHover")).toHaveLength(2);
    expect(wrapper.emitted("stateHover")![1][0]).toBeNull();
  });
});
