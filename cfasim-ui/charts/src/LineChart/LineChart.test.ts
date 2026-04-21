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

  it("accepts a typed array as data", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(LineChart, {
      props: {
        data: new Float64Array([0, 10, 20]),
        height: 100,
        menu: false,
      },
    });
    const path = wrapper.find("path");
    expect(path.attributes("d")).toBeTruthy();
    const vueWarnings = warn.mock.calls.filter((c) =>
      String(c[0] ?? "").includes("[Vue warn]"),
    );
    expect(vueWarnings).toEqual([]);
    warn.mockRestore();
  });

  it("accepts a typed array inside a series", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [
          { data: new Int32Array([0, 5, 10]), dots: true },
          { data: new Float64Array([10, 5, 0]) },
        ],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("path").length).toBe(2);
    expect(wrapper.findAll("circle").length).toBe(3);
  });

  it("generates CSV from typed array data", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: new Float64Array([1.5, 2.5, 3.5]),
        height: 100,
        menu: false,
        downloadLink: true,
      },
    });
    const link = wrapper.find("a.line-chart-download-link");
    expect(link.attributes("href")).toContain(
      encodeURIComponent("index,value\n0,1.5\n1,2.5\n2,3.5"),
    );
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

  it("positions tooltip on the first mousemove that opens it", async () => {
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
    // Give the async updateTooltipPos a tick to complete after DOM flush.
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    const tooltip = wrapper.element.querySelector(
      ".chart-tooltip-content",
    ) as HTMLElement;
    expect(tooltip).toBeTruthy();
    // Before the fix, updateTooltipPos ran before the tooltip was mounted
    // and returned early, so no transform was applied — the element
    // rendered at the wrapper's (0, 0) corner.
    expect(tooltip.style.transform).toContain("translate3d");
    expect(tooltip.style.visibility).toBe("visible");
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

  describe("tick customization", () => {
    function xTickLabels(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll('[data-testid="x-tick"]').map((t) => t.text());
    }
    function yTickLabels(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll('[data-testid="y-tick"]').map((t) => t.text());
    }

    it("places x-axis ticks at a numeric interval respecting xMin", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: Array.from({ length: 15 }, (_, i) => i),
          xMin: 0,
          xTicks: 5,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = xTickLabels(wrapper);
      expect(labels).toEqual(expect.arrayContaining(["0", "5", "10"]));
      expect(labels).not.toContain("3");
    });

    it("places x-axis ticks at explicit values", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: Array.from({ length: 10 }, (_, i) => i),
          xTicks: [0, 3, 7],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = xTickLabels(wrapper);
      expect(labels).toEqual(expect.arrayContaining(["0", "3", "7"]));
    });

    it("drops explicit x-tick values outside data range", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 1, 2, 3, 4],
          xTicks: [-1, 2, 99],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = xTickLabels(wrapper);
      expect(labels).toContain("2");
      expect(labels).not.toContain("-1");
      expect(labels).not.toContain("99");
    });

    it("formats x-axis ticks with xTickFormat", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 1, 2, 3, 4],
          xTicks: [0, 2, 4],
          xTickFormat: (v: number) => `day-${v}`,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = xTickLabels(wrapper);
      expect(labels).toEqual(
        expect.arrayContaining(["day-0", "day-2", "day-4"]),
      );
    });

    it("places y-axis ticks at a numeric interval", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 25, 50, 75, 100],
          yTicks: 25,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      expect(yTickLabels(wrapper)).toEqual(
        expect.arrayContaining(["0", "25", "50", "75", "100"]),
      );
    });

    it("places y-axis ticks at explicit values", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 50, 100],
          yTicks: [10, 90],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      expect(yTickLabels(wrapper)).toEqual(
        expect.arrayContaining(["10", "90"]),
      );
    });

    it("formats y-axis ticks with yTickFormat", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 0.5, 1],
          yTicks: [0, 0.5, 1],
          yTickFormat: (v: number) => `${(v * 100).toFixed(0)}%`,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      expect(yTickLabels(wrapper)).toEqual(
        expect.arrayContaining(["0%", "50%", "100%"]),
      );
    });

    it("falls back to xLabels when xTickFormat is not provided", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 1, 2, 3],
          xLabels: ["Jan", "Feb", "Mar", "Apr"],
          xTicks: [0, 2],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = xTickLabels(wrapper);
      expect(labels).toEqual(expect.arrayContaining(["Jan", "Mar"]));
    });

    it("uses xTickFormat for the tooltip x-label", async () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [10, 20, 30, 40, 50],
          xMin: 0,
          xTickFormat: (v: number) => `day-${v}`,
          width: 400,
          height: 200,
          menu: false,
          tooltipTrigger: "hover" as const,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
      const label = wrapper.find(".line-chart-tooltip-label");
      expect(label.exists()).toBe(true);
      expect(label.text()).toMatch(/^day-\d+$/);
      wrapper.unmount();
    });

    it("anchors edge x-ticks to start/end to prevent clipping", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: Array.from({ length: 11 }, (_, i) => i),
          xTicks: [0, 5, 10],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const ticks = wrapper.findAll('[data-testid="x-tick"]');
      const anchors = ticks.map((t) => t.attributes("text-anchor"));
      expect(anchors[0]).toBe("start");
      expect(anchors[anchors.length - 1]).toBe("end");
      // interior tick stays centered
      expect(anchors.slice(1, -1).every((a) => a === "middle")).toBe(true);
    });

    it("ignores zero or negative intervals", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 1, 2, 3, 4],
          xTicks: 0,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      expect(xTickLabels(wrapper)).toEqual([]);
    });
  });

  describe("x/y data", () => {
    function dataPath(wrapper: ReturnType<typeof mount>): string {
      // In a simple chart the last <path> element is the series line.
      const paths = wrapper.findAll("path");
      return paths[paths.length - 1].attributes("d") ?? "";
    }

    it("plots points at the supplied x positions", () => {
      const wrapper = mount(LineChart, {
        props: {
          x: [0, 1, 10],
          y: [0, 5, 10],
          width: 410, // innerW = 410 - 50 - 10 = 350
          height: 100,
          menu: false,
        },
      });
      const d = dataPath(wrapper);
      // With x=[0,1,10] and innerW=350 starting at padding.left=50, the
      // middle point should sit at 50 + (1/10)*350 = 85, not evenly spaced.
      // The matches look for `M50,...L85,...L400,...`.
      expect(d).toMatch(/^M50,/);
      expect(d).toMatch(/L85,/);
      expect(d).toMatch(/L400,/);
    });

    it("accepts y as an alias for data", () => {
      const fromY = mount(LineChart, {
        props: { y: [0, 10, 20], height: 100, menu: false },
      });
      const fromData = mount(LineChart, {
        props: { data: [0, 10, 20], height: 100, menu: false },
      });
      expect(dataPath(fromY)).toBe(dataPath(fromData));
    });

    it("prefers y over data when both are set", () => {
      const wrapper = mount(LineChart, {
        props: {
          y: [0, 10, 20],
          data: [999, 999, 999],
          height: 100,
          menu: false,
          downloadLink: true,
        },
      });
      const href = wrapper
        .find("a.line-chart-download-link")
        .attributes("href")!;
      expect(decodeURIComponent(href)).toContain("0,0\n1,10\n2,20");
      expect(decodeURIComponent(href)).not.toContain("999");
    });

    it("accepts y on Series (per-series)", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [
            { x: [0, 1, 2], y: [0, 10, 20] },
            { x: [0, 1, 2], y: [20, 10, 0] },
          ],
          height: 100,
          menu: false,
        },
      });
      expect(wrapper.findAll("path").length).toBe(2);
    });

    it("derives x-extent from explicit x values (not indices)", () => {
      const wrapper = mount(LineChart, {
        props: {
          x: [100, 200, 400],
          y: [1, 2, 3],
          width: 400,
          height: 100,
          menu: false,
        },
      });
      const ticks = wrapper
        .findAll('[data-testid="x-tick"]')
        .map((t) => t.text());
      // Tick values should reflect the x range 100..400, not 0..2.
      expect(ticks.some((t) => Number(t) >= 100 && Number(t) <= 400)).toBe(
        true,
      );
      expect(ticks).not.toContain("2");
    });

    it("accepts per-series x and y values", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [
            { y: [0, 10, 20], x: [0, 5, 10] },
            { y: [5, 15, 25], x: [2, 7, 12] },
          ],
          width: 400,
          height: 100,
          menu: false,
        },
      });
      expect(wrapper.findAll("path").length).toBe(2);
    });

    it("accepts typed arrays for x and y", () => {
      const wrapper = mount(LineChart, {
        props: {
          x: new Float64Array([0, 1.5, 10]),
          y: new Float64Array([0, 5, 10]),
          height: 100,
          menu: false,
        },
      });
      expect(dataPath(wrapper)).toBeTruthy();
    });

    it("ignores xMin when explicit x is provided", () => {
      const wrapper = mount(LineChart, {
        props: {
          x: [10, 20, 30],
          y: [1, 2, 3],
          xMin: 1000, // should be ignored
          xTicks: [10, 20, 30],
          width: 400,
          height: 100,
          menu: false,
        },
      });
      const ticks = wrapper
        .findAll('[data-testid="x-tick"]')
        .map((t) => t.text());
      expect(ticks).toEqual(expect.arrayContaining(["10", "20", "30"]));
      expect(ticks).not.toContain("1010");
    });

    it("skips points with non-finite x", () => {
      const wrapper = mount(LineChart, {
        props: {
          x: [0, NaN, 10],
          y: [0, 5, 10],
          height: 100,
          menu: false,
        },
      });
      // Path should have a break: M...M... (two segments).
      const d = dataPath(wrapper);
      expect((d.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it("emits CSV with an x column when x is shared", () => {
      const wrapper = mount(LineChart, {
        props: {
          x: [0, 2.5, 10],
          y: [1, 2, 3],
          height: 100,
          menu: false,
          downloadLink: true,
        },
      });
      const href = wrapper
        .find("a.line-chart-download-link")
        .attributes("href")!;
      expect(decodeURIComponent(href)).toContain("x,value\n0,1\n2.5,2\n10,3");
    });

    it("emits hover with index from nearest-x search", async () => {
      const wrapper = mount(LineChart, {
        props: {
          x: [0, 1, 10],
          y: [0, 5, 10],
          width: 410,
          height: 100,
          menu: false,
          tooltipTrigger: "hover" as const,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      // Click near pixel x for data-x=1 (at ~85px). Should select index 1.
      await overlay.trigger("mousemove", { clientX: 85, clientY: 50 });
      const events = wrapper.emitted("hover")!;
      const last = events[events.length - 1][0] as { index: number };
      expect(last.index).toBe(1);
      wrapper.unmount();
    });
  });

  describe("areaSections", () => {
    it("renders area section fill paths", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30] }],
          areaSections: [{ seriesIndex: 0, startIndex: 1, endIndex: 3 }],
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
          areaSections: [{ seriesIndex: 0, startIndex: 0, endIndex: 2 }],
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

    it("anchors label indicator circle to the section start", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          areaSections: [{ startIndex: 1, endIndex: 2, label: "Day 2" }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      // padding.left = 50 (no yLabel), innerW = 400 - 50 - 10 = 340
      // xPixel(1) with range 0..2 = 50 + 0.5 * 340 = 220
      const expectedStart = 220;
      const labelCircles = wrapper
        .findAll("circle")
        .filter((c) => c.attributes("r") === "4");
      expect(labelCircles.length).toBe(1);
      const cx = Number(labelCircles[0].attributes("cx"));
      expect(cx).toBeCloseTo(expectedStart, 0);
    });

    it("clamps label so right edge stays within the chart", () => {
      const longLabel = "x".repeat(40);
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          areaSections: [{ startIndex: 2, endIndex: 2, label: longLabel }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      // padding.left = 50, innerW = 340, so chart right edge = 390.
      // textWidth = 40 * 7 = 280; preferred cx = 390 + 140 + 2 = 532 → overflow.
      // Clamped: cx = 390 - 140 - 8 = 242. Label text right edge = cx + 140 + 8 = 390.
      const labelGroups = wrapper.findAll("g").filter((g) => {
        const c = g.find("circle");
        return c.exists() && c.attributes("r") === "4";
      });
      expect(labelGroups.length).toBe(1);
      const textEl = labelGroups[0].findAll("text")[0];
      const textX = Number(textEl.attributes("x"));
      const textWidth = longLabel.length * 7;
      const textRight = textX + textWidth;
      expect(textRight).toBeLessThanOrEqual(390);
      expect(textRight).toBeCloseTo(390, 0);
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
