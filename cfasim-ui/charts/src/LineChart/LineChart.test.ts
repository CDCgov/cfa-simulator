import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import LineChart from "./LineChart.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import * as download from "../ChartMenu/download.js";

describe("LineChart", () => {
  it("renders a single series as a path", () => {
    const wrapper = mount(LineChart, {
      props: { data: [0, 10, 20], height: 100, menu: false },
    });
    const paths = wrapper.findAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    const dataPath = paths[paths.length - 1];
    expect(dataPath.attributes("d")).toBeTruthy();
    expect(dataPath.attributes("fill")).toBe("none");
  });

  it("renders multiple series as separate paths", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 5, 10] }, { data: [10, 5, 0] }],
        height: 100,
        menu: false,
      },
    });
    const paths = wrapper.findAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it("does not render dots by default", () => {
    const wrapper = mount(LineChart, {
      props: { data: [0, 10, 20], height: 100, menu: false },
    });
    expect(wrapper.findAll("circle").length).toBe(0);
  });

  it("renders dots when dots option is true", () => {
    const data = [0, 10, 20];
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data, dots: true }],
        height: 100,
        width: 200,
        menu: false,
      },
    });
    const circles = wrapper.findAll("circle");
    expect(circles.length).toBe(data.length);
  });

  it("skips dots for non-finite values", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, NaN, 20], dots: true }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("circle").length).toBe(2);
  });

  it("applies dotRadius", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotRadius: 5 }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("r")).toBe("5");
  });

  it("applies dotFill", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotFill: "red" }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill")).toBe("red");
  });

  it("applies dotStroke", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotStroke: "#fff" }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("stroke")).toBe("#fff");
  });

  it("defaults dotFill to series color", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, color: "#0057b7" }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill")).toBe("#0057b7");
  });

  it("only renders dots for series with dots enabled", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], dots: true }, { data: [20, 10, 0] }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("circle").length).toBe(3);
  });

  it("renders a line by default", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20] }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("path").length).toBe(1);
  });

  it("hides the line when line is false", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], line: false, dots: true }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("path").length).toBe(0);
    expect(wrapper.findAll("circle").length).toBe(3);
  });

  it("applies per-series lineOpacity to stroke-opacity", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], lineOpacity: 0.3 }],
        height: 100,
        menu: false,
      },
    });
    const path = wrapper.find("path");
    expect(path.attributes("stroke-opacity")).toBe("0.3");
  });

  it("applies per-series dotOpacity to fill-opacity", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotOpacity: 0.5 }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill-opacity")).toBe("0.5");
  });

  it("lineOpacity overrides series opacity for lines", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], opacity: 0.8, lineOpacity: 0.2 }],
        height: 100,
        menu: false,
      },
    });
    const path = wrapper.find("path");
    expect(path.attributes("stroke-opacity")).toBe("0.2");
  });

  it("dotOpacity overrides series opacity for dots", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, opacity: 0.8, dotOpacity: 0.4 }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill-opacity")).toBe("0.4");
  });

  it("renders tooltip overlay when tooltipTrigger is set", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        height: 100,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
    });
    const rects = wrapper.findAll("rect");
    const overlay = rects.find((r) => r.attributes("fill") === "transparent");
    expect(overlay).toBeTruthy();
  });

  it("does not render tooltip overlay without tooltipTrigger", () => {
    const wrapper = mount(LineChart, {
      props: { data: [0, 10, 20], height: 100, menu: false },
    });
    const rects = wrapper.findAll("rect");
    const overlay = rects.find((r) => r.attributes("fill") === "transparent");
    expect(overlay).toBeUndefined();
  });

  it("emits hover event on mousemove over overlay", async () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        width: 400,
        height: 100,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
      attachTo: document.body,
    });
    const overlay = wrapper
      .findAll("rect")
      .find((r) => r.attributes("fill") === "transparent")!;
    await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
    expect(wrapper.emitted("hover")).toBeTruthy();
    expect(wrapper.emitted("hover")![0][0]).toHaveProperty("index");
    wrapper.unmount();
  });

  describe("menu downloads", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    function getMenuItem(wrapper: ReturnType<typeof mount>, label: string) {
      const items = wrapper.findComponent(ChartMenu).props("items");
      const item = items.find((i) => i.label === label);
      if (!item) throw new Error(`menu item not found: ${label}`);
      return item;
    }

    it("auto-generates CSV from series by default", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100 },
      });
      getMenuItem(wrapper, "Download CSV").action();
      expect(spy).toHaveBeenCalledOnce();
      const [csv, fname] = spy.mock.calls[0];
      expect(csv).toBe("index,value\n0,1\n1,2\n2,3");
      expect(fname).toBe("chart");
    });

    it("uses custom csv string when provided", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const custom = "date,cases\n2024-01-01,10\n2024-01-02,20";
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, csv: custom },
      });
      getMenuItem(wrapper, "Download CSV").action();
      expect(spy).toHaveBeenCalledWith(custom, "chart");
    });

    it("uses custom csv function when provided", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const fn = vi.fn(() => "a,b\n1,2");
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, csv: fn },
      });
      getMenuItem(wrapper, "Download CSV").action();
      expect(fn).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith("a,b\n1,2", "chart");
    });

    it("uses filename prop for CSV downloads", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, filename: "my-data" },
      });
      getMenuItem(wrapper, "Download CSV").action();
      expect(spy).toHaveBeenCalledWith(expect.any(String), "my-data");
    });

    it("filename prop takes precedence over menu string", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          height: 100,
          menu: "legacy-name",
          filename: "preferred-name",
        },
      });
      getMenuItem(wrapper, "Download CSV").action();
      expect(spy).toHaveBeenCalledWith(expect.any(String), "preferred-name");
    });

    it("does not render a download link by default", () => {
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100 },
      });
      expect(wrapper.find("a.line-chart-download-link").exists()).toBe(false);
    });

    it("renders a download link with default text when downloadLink=true", () => {
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, downloadLink: true },
      });
      const link = wrapper.find("a.line-chart-download-link");
      expect(link.exists()).toBe(true);
      expect(link.text()).toBe("Download data (CSV)");
      expect(link.attributes("download")).toBe("chart.csv");
      expect(link.attributes("href")).toContain("data:text/csv");
      expect(link.attributes("href")).toContain(
        encodeURIComponent("index,value\n0,1\n1,2\n2,3"),
      );
    });

    it("renders a download link with custom text when downloadLink is a string", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          height: 100,
          downloadLink: "Get the data",
          filename: "my-data",
        },
      });
      const link = wrapper.find("a.line-chart-download-link");
      expect(link.text()).toBe("Get the data");
      expect(link.attributes("download")).toBe("my-data.csv");
    });

    it("hides Download CSV menu item when downloadLink is set", () => {
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, downloadLink: true },
      });
      const items = wrapper.findComponent(ChartMenu).props("items");
      expect(items.find((i) => i.label === "Download CSV")).toBeUndefined();
      expect(items.find((i) => i.label === "Save as SVG")).toBeTruthy();
    });

    it("download link uses custom csv content", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          height: 100,
          downloadLink: true,
          csv: "date,cases\n2024-01-01,10",
        },
      });
      const link = wrapper.find("a.line-chart-download-link");
      expect(link.attributes("href")).toContain(
        encodeURIComponent("date,cases\n2024-01-01,10"),
      );
    });

    it("uses filename prop for SVG downloads", () => {
      const spy = vi.spyOn(download, "saveSvg").mockImplementation(() => {});
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, filename: "my-chart" },
      });
      getMenuItem(wrapper, "Save as SVG").action();
      expect(spy).toHaveBeenCalledWith(expect.anything(), "my-chart");
    });
  });

  it("emits hover null on mouseleave", async () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        width: 400,
        height: 100,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
      attachTo: document.body,
    });
    const overlay = wrapper
      .findAll("rect")
      .find((r) => r.attributes("fill") === "transparent")!;
    await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
    await overlay.trigger("mouseleave");
    const events = wrapper.emitted("hover")!;
    expect(events[events.length - 1][0]).toBeNull();
    wrapper.unmount();
  });

  describe("areaSections", () => {
    it("renders area section fill paths", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30] }],
          areaSections: [{ startIndex: 1, endIndex: 3 }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const paths = wrapper.findAll("path");
      // 1 series line + 1 area section fill + 1 area section line
      expect(paths.length).toBe(3);
      const fillPath = paths[1];
      expect(fillPath.attributes("fill-opacity")).toBe("0.15");
      expect(fillPath.attributes("stroke")).toBe("none");
      const linePath = paths[2];
      expect(linePath.attributes("fill")).toBe("none");
      expect(linePath.attributes("stroke")).toBeTruthy();
    });

    it("uses explicit section color", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          areaSections: [{ startIndex: 0, endIndex: 2, color: "#ff0000" }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const paths = wrapper.findAll("path");
      const sectionPath = paths[1];
      expect(sectionPath.attributes("fill")).toBe("#ff0000");
    });

    it("defaults section color to series color", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20], color: "#0057b7" }],
          areaSections: [{ startIndex: 0, endIndex: 2 }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const paths = wrapper.findAll("path");
      const sectionPath = paths[1];
      expect(sectionPath.attributes("fill")).toBe("#0057b7");
    });

    it("applies custom opacity", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          areaSections: [{ startIndex: 0, endIndex: 2, opacity: 0.5 }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const paths = wrapper.findAll("path");
      expect(paths[1].attributes("fill-opacity")).toBe("0.5");
    });

    it("renders tick marks at section boundaries", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30] }],
          areaSections: [{ startIndex: 1, endIndex: 3 }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const lines = wrapper.findAll("line");
      // 2 axis lines + 2 tick marks for section boundaries
      const tickLines = lines.filter(
        (l) => l.attributes("stroke-opacity") === "0.4",
      );
      expect(tickLines.length).toBe(2);
    });

    it("renders label text when label is provided", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          areaSections: [
            {
              startIndex: 0,
              endIndex: 2,
              label: "Day 1–3",
              description: "Some info",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text");
      const labelTexts = texts.map((t) => t.text());
      expect(labelTexts).toContain("Day 1–3");
      expect(labelTexts).toContain("Some info");
    });

    it("increases SVG height when labels are present", () => {
      const withoutLabels = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const withLabels = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          areaSections: [{ startIndex: 0, endIndex: 2, label: "Test" }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const h1 = Number(withoutLabels.find("svg").attributes("height"));
      const h2 = Number(withLabels.find("svg").attributes("height"));
      expect(h2).toBeGreaterThan(h1);
    });

    it("does not increase SVG height without labels", () => {
      const withoutSections = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const withSectionsNoLabels = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          areaSections: [{ startIndex: 0, endIndex: 2 }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const h1 = Number(withoutSections.find("svg").attributes("height"));
      const h2 = Number(withSectionsNoLabels.find("svg").attributes("height"));
      expect(h2).toBe(h1);
    });

    it("stacks overlapping labels into different rows", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30, 40] }],
          areaSections: [
            {
              startIndex: 0,
              endIndex: 2,
              label: "First section label",
            },
            {
              startIndex: 1,
              endIndex: 3,
              label: "Second section label",
            },
          ],
          height: 200,
          width: 300,
          menu: false,
        },
      });
      // Two label groups means two circles (indicators)
      const groups = wrapper.findAll("g");
      const labelGroups = groups.filter((g) => {
        const circle = g.find("circle");
        return circle.exists() && circle.attributes("r") === "4";
      });
      expect(labelGroups.length).toBe(2);
      // They should have different y positions for their text
      const labelTexts = labelGroups.map(
        (g) => g.find("text").attributes("y")!,
      );
      expect(labelTexts[0]).not.toBe(labelTexts[1]);
    });

    it("does not render extra elements without areaSections", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const paths = wrapper.findAll("path");
      expect(paths.length).toBe(1); // just the series line
    });
  });
});
