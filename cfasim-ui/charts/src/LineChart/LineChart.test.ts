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

  it("does not render an outline path by default", () => {
    const wrapper = mount(LineChart, {
      props: { data: [0, 10, 20], height: 100, menu: false },
    });
    expect(wrapper.find('[data-testid="line-outline"]').exists()).toBe(false);
  });

  it("renders a page-colored outline behind the line when outline is true", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], outline: true, strokeWidth: 2 }],
        height: 100,
        menu: false,
      },
    });
    const outline = wrapper.find('[data-testid="line-outline"]');
    expect(outline.exists()).toBe(true);
    expect(outline.attributes("stroke")).toBe("var(--color-bg-0, #fff)");
    // outline stroke = strokeWidth + 4 (2px each side)
    expect(outline.attributes("stroke-width")).toBe("6");
    // outline is rendered before the data line (so it sits behind)
    const paths = wrapper.findAll("path");
    const outlineIdx = paths.findIndex(
      (p) => p.attributes("data-testid") === "line-outline",
    );
    const dataIdx = paths.findIndex(
      (p) => p.attributes("stroke") !== "var(--color-bg-0, #fff)",
    );
    expect(outlineIdx).toBeGreaterThanOrEqual(0);
    expect(outlineIdx).toBeLessThan(dataIdx);
  });

  it("honors outlineColor and outlineWidth overrides", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [
          {
            data: [0, 10, 20],
            outline: true,
            strokeWidth: 2,
            outlineColor: "#000",
            outlineWidth: 8,
          },
        ],
        height: 100,
        menu: false,
      },
    });
    const outline = wrapper.find('[data-testid="line-outline"]');
    expect(outline.attributes("stroke")).toBe("#000");
    // outline stroke = strokeWidth + outlineWidth
    expect(outline.attributes("stroke-width")).toBe("10");
  });

  it("does not render an outline when line is false", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], outline: true, line: false, dots: true }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.find('[data-testid="line-outline"]').exists()).toBe(false);
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

  it("applies blendMode as mix-blend-mode style on line and dots", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [
          {
            data: [0, 10, 20],
            dots: true,
            blendMode: "multiply" as const,
          },
          { data: [5, 15, 25], dots: true },
        ],
        height: 100,
        menu: false,
      },
    });
    // The first (blended) line path's style includes mix-blend-mode.
    const paths = wrapper.findAll("path").filter((p) => p.attributes("d"));
    const blendedPath = paths[0];
    expect(blendedPath.attributes("style")).toContain(
      "mix-blend-mode: multiply",
    );
    // Plain second series has no blend-mode style.
    expect(paths[1].attributes("style") ?? "").not.toContain("mix-blend-mode");
    // Dots on the blended series also pick up the blend mode.
    const circles = wrapper.findAll("circle");
    expect(circles[0].attributes("style")).toContain(
      "mix-blend-mode: multiply",
    );
  });

  it("applies blendMode as mix-blend-mode style on an area fill", () => {
    const wrapper = mount(LineChart, {
      props: {
        areas: [
          {
            upper: [10, 20, 30],
            lower: [0, 5, 10],
            color: "#ef4444",
            blendMode: "multiply" as const,
          },
          { upper: [12, 22, 32], lower: [2, 7, 12], color: "#3b82f6" },
        ],
        height: 100,
        menu: false,
      },
    });
    // Area fills are the paths with a non-"none" fill.
    const fills = wrapper
      .findAll("path")
      .filter((p) => p.attributes("fill") && p.attributes("fill") !== "none");
    expect(fills[0].attributes("style")).toContain("mix-blend-mode: multiply");
    // Plain second area has no blend-mode style.
    expect(fills[1].attributes("style") ?? "").not.toContain("mix-blend-mode");
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
    // pan-y lets a vertical swipe scroll the page while horizontal drags
    // still scrub the tooltip.
    expect(overlay?.attributes("style")).toContain("touch-action: pan-y");
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
    // The component root is a <Teleport>, so query the attached document
    // rather than `wrapper.element` (which is the teleport anchor comment).
    const tooltip = document.querySelector(
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

    it("renders a download button with default text when downloadButton=true", () => {
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, downloadButton: true },
      });
      const button = wrapper.find("button.line-chart-download-button");
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe("Download data (CSV)");
    });

    it("renders a download button with custom text when downloadButton is a string", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          height: 100,
          downloadButton: "Get the data",
        },
      });
      const button = wrapper.find("button.line-chart-download-button");
      expect(button.text()).toBe("Get the data");
    });

    it("hides Download CSV menu item and link when downloadButton is set", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          height: 100,
          downloadButton: true,
          downloadLink: true,
        },
      });
      const items = wrapper.findComponent(ChartMenu).props("items");
      expect(items.find((i) => i.label === "Download CSV")).toBeUndefined();
      expect(wrapper.find("a.line-chart-download-link").exists()).toBe(false);
    });

    it("downloads CSV when the download button is clicked", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          height: 100,
          downloadButton: true,
          filename: "my-data",
        },
      });
      wrapper.find("button.line-chart-download-button").trigger("click");
      expect(spy).toHaveBeenCalledWith(expect.any(String), "my-data");
    });

    it("uses filename prop for SVG downloads", () => {
      const spy = vi.spyOn(download, "saveSvg").mockImplementation(() => {});
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100, filename: "my-chart" },
      });
      getMenuItem(wrapper, "Save as SVG").action();
      expect(spy).toHaveBeenCalledWith(expect.anything(), "my-chart");
    });

    describe("expand", () => {
      it("forwards fallthrough attrs (class, data-*) onto the wrapper despite the Teleport root", () => {
        const wrapper = mount(LineChart, {
          props: { data: [1, 2, 3], height: 100 },
          attrs: { "data-testid": "my-chart", class: "consumer-class" },
        });
        const root = wrapper.find(".line-chart-wrapper");
        expect(root.attributes("data-testid")).toBe("my-chart");
        // Consumer class merges with the component's own class.
        expect(root.classes()).toContain("consumer-class");
      });

      it("places the Fullscreen item at the top of the menu", () => {
        const wrapper = mount(LineChart, {
          props: { data: [1, 2, 3], height: 100 },
        });
        const items = wrapper.findComponent(ChartMenu).props("items");
        expect(items[0].label).toBe("Fullscreen");
        expect(items[0].ariaPressed).toBe(false);
      });

      // When expanded, the wrapper teleports to <body>, so query the live
      // document rather than the component subtree.
      const expandedEl = () =>
        document.querySelector<HTMLElement>(
          ".line-chart-wrapper.is-fullscreen",
        );

      it("toggles between Fullscreen and Collapse labels", async () => {
        const wrapper = mount(LineChart, {
          props: { data: [1, 2, 3], height: 100 },
          attachTo: document.body,
        });
        const expand = wrapper
          .findComponent(ChartMenu)
          .props("items")
          .find((i) => i.label === "Fullscreen");
        expect(expand).toBeTruthy();
        expand!.action();
        await wrapper.vm.$nextTick();
        const collapse = wrapper
          .findComponent(ChartMenu)
          .props("items")
          .find((i) => i.label === "Collapse");
        expect(collapse).toBeTruthy();
        expect(collapse!.ariaPressed).toBe(true);
        // The critical layout is applied inline so it can't be lost to CSS
        // source-order or a missing stylesheet import.
        const el = expandedEl();
        expect(el).not.toBeNull();
        expect(el!.style.position).toBe("fixed");
        wrapper.unmount();
      });

      it("exits expanded view on Escape", async () => {
        const wrapper = mount(LineChart, {
          props: { data: [1, 2, 3], height: 100 },
          attachTo: document.body,
        });
        const expand = wrapper
          .findComponent(ChartMenu)
          .props("items")
          .find((i) => i.label === "Fullscreen");
        expand!.action();
        await wrapper.vm.$nextTick();
        expect(expandedEl()).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await wrapper.vm.$nextTick();
        expect(expandedEl()).toBeNull();
        wrapper.unmount();
      });

      it("ignores Escape when the event originates inside an open menu", async () => {
        const wrapper = mount(LineChart, {
          props: { data: [1, 2, 3], height: 100 },
          attachTo: document.body,
        });
        const expand = wrapper
          .findComponent(ChartMenu)
          .props("items")
          .find((i) => i.label === "Fullscreen");
        expand!.action();
        await wrapper.vm.$nextTick();
        // Simulate Reka's portal'd dropdown content: an element with
        // role="menu" appended to document.body that holds keyboard focus.
        const menu = document.createElement("div");
        menu.setAttribute("role", "menu");
        const item = document.createElement("button");
        menu.appendChild(item);
        document.body.appendChild(menu);
        item.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await wrapper.vm.$nextTick();
        expect(expandedEl()).not.toBeNull();
        document.body.removeChild(menu);
        wrapper.unmount();
      });

      it("locks and restores document.body overflow while expanded", async () => {
        document.body.style.overflow = "auto";
        const wrapper = mount(LineChart, {
          props: { data: [1, 2, 3], height: 100 },
          attachTo: document.body,
        });
        const expand = wrapper
          .findComponent(ChartMenu)
          .props("items")
          .find((i) => i.label === "Fullscreen");
        expand!.action();
        await wrapper.vm.$nextTick();
        expect(document.body.style.overflow).toBe("hidden");
        const collapse = wrapper
          .findComponent(ChartMenu)
          .props("items")
          .find((i) => i.label === "Collapse");
        collapse!.action();
        await wrapper.vm.$nextTick();
        expect(document.body.style.overflow).toBe("auto");
        wrapper.unmount();
        document.body.style.overflow = "";
      });

      it("swaps the menu trigger for a close button while expanded, and the close button collapses", async () => {
        const wrapper = mount(LineChart, {
          props: { data: [1, 2, 3], height: 100 },
          attachTo: document.body,
        });
        const expand = wrapper
          .findComponent(ChartMenu)
          .props("items")
          .find((i) => i.label === "Fullscreen");
        expand!.action();
        await wrapper.vm.$nextTick();

        const close = document.querySelector<HTMLButtonElement>(
          ".chart-close-button",
        );
        expect(close).not.toBeNull();
        // The "Chart options" (⋯) trigger is gone while expanded.
        expect(
          document.querySelector('[aria-label="Chart options"]'),
        ).toBeNull();

        close!.click();
        await wrapper.vm.$nextTick();
        expect(expandedEl()).toBeNull();
        expect(
          document.querySelector('[aria-label="Chart options"]'),
        ).not.toBeNull();
        wrapper.unmount();
      });
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

  it("accepts a typed array for tooltipData", async () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [10, 20, 30, 40, 50],
        tooltipData: new Float64Array([0.1, 0.2, 0.3, 0.4, 0.5]),
        tooltipTrigger: "hover" as const,
        width: 400,
        height: 200,
        menu: false,
      },
      slots: {
        tooltip: `
          <template #default="props">
            <div data-testid="slot-data">{{ props.data }}</div>
          </template>
        `,
      },
      attachTo: document.body,
    });
    const overlay = wrapper
      .findAll("rect")
      .find((r) => r.attributes("fill") === "transparent")!;
    await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
    expect(wrapper.find('[data-testid="slot-data"]').text()).toMatch(/^0\./);
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

    it("uses tooltipValueFormat for tooltip values", async () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1000, 2000, 3000],
          tooltipValueFormat: (v: number) => `$${v.toLocaleString()}`,
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
      const row = wrapper.find(".line-chart-tooltip-row");
      expect(row.exists()).toBe(true);
      expect(row.text()).toMatch(/^\$[\d,]+$/);
      wrapper.unmount();
    });

    it("omits a series from the tooltip when showInTooltip is false", async () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [
            { data: [1, 2, 3], color: "#0057b7" },
            { data: [4, 5, 6], color: "#f4a261", showInTooltip: false },
          ],
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
      expect(wrapper.findAll(".line-chart-tooltip-row").length).toBe(1);
      // Hover dot is also suppressed for the hidden series. Hover dots have
      // a white stroke; other circles (e.g. series dots) do not.
      const hoverDots = wrapper
        .findAll("circle")
        .filter((c) => c.attributes("stroke-width") === "2");
      expect(hoverDots.length).toBe(1);
      wrapper.unmount();
    });

    it("hides a series legend entry when showInLegend is false", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [
            { data: [1, 2, 3], legend: "Cases" },
            { data: [4, 5, 6], legend: "Reference", showInLegend: false },
          ],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text").map((t) => t.text());
      expect(texts).toContain("Cases");
      expect(texts).not.toContain("Reference");
    });

    it("wraps inline legend items to multiple rows when they overflow width", () => {
      const series = Array.from({ length: 10 }, (_, i) => ({
        data: [i + 1, i + 2, i + 3],
        legend: `Series ${i + 1} with longer label`,
      }));
      const wrapper = mount(LineChart, {
        props: { series, width: 400, height: 200, menu: false },
      });
      const labelYs = new Set(
        wrapper
          .findAll("text")
          .filter((t) => /^Series /.test(t.text()))
          .map((t) => t.attributes("y")),
      );
      expect(labelYs.size).toBeGreaterThan(1);
    });

    it("falls back to yTickFormat for tooltip values when tooltipValueFormat is not set", async () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          yTickFormat: (v: number) => `${v}%`,
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
      const row = wrapper.find(".line-chart-tooltip-row");
      expect(row.text()).toMatch(/\d+%$/);
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

  describe("annotations", () => {
    it("does not render the annotations group when no annotations are provided", () => {
      const wrapper = mount(LineChart, {
        props: { data: [0, 10, 20], height: 200, width: 400, menu: false },
      });
      expect(wrapper.find("g.chart-annotations").exists()).toBe(false);
    });

    it("renders outline passes for the pointer line and arrow by default", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 30, y: -20 },
              text: "Peak",
              lineWidth: 2,
              outlineWidth: 4,
              outlineColor: "#fff",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      const outlinePath = group.find("path.annotation-outline");
      expect(outlinePath.exists()).toBe(true);
      expect(outlinePath.attributes("stroke")).toBe("#fff");
      // Outline stroke = lineWidth + outlineWidth.
      expect(outlinePath.attributes("stroke-width")).toBe("6");
      // Outlines drop stroke-dasharray so the halo stays solid.
      expect(outlinePath.attributes("stroke-dasharray")).toBeUndefined();
      const outlineArrow = group.find("polygon.annotation-outline");
      expect(outlineArrow.exists()).toBe(true);
    });

    it("suppresses the outline passes when outlineWidth is 0", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 30, y: -20 },
              text: "Peak",
              outlineWidth: 0,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      expect(
        wrapper.find("g.chart-annotations .annotation-outline").exists(),
      ).toBe(false);
    });

    it("renders an annotation with a pointer path and outline text", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            { x: 1, y: 10, offset: { x: 30, y: -20 }, text: "Peak" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      expect(group.exists()).toBe(true);
      const pointer = group.find("path");
      expect(pointer.exists()).toBe(true);
      expect(pointer.attributes("d")).toMatch(/^M[\d.,-]+ Q[\d.,-]+ [\d.,-]+$/);
      const text = group.find("text");
      expect(text.attributes("paint-order")).toBe("stroke fill");
      expect(text.attributes("stroke-width")).toBe("3");
      expect(text.text()).toContain("Peak");
    });

    it("uses a straight line when offset is only horizontal", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            { x: 1, y: 10, offset: { x: 30, y: 0 }, text: "right" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const d = wrapper.find("g.chart-annotations path").attributes("d");
      // Straight line: starts with M, has L (not Q).
      expect(d).toMatch(/^M[\d.,-]+ L[\d.,-]+$/);
    });

    it("uses a straight line when offset is only vertical", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [{ x: 1, y: 10, offset: { x: 0, y: -30 }, text: "up" }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const d = wrapper.find("g.chart-annotations path").attributes("d");
      expect(d).toMatch(/^M[\d.,-]+ L[\d.,-]+$/);
    });

    it("connects multi-line text above the point to its bottom edge", () => {
      // Text sits above the anchor (negative y offset), so the connector
      // should end below the first line of text — attaching to the block's
      // bottom edge instead of cutting up through the lower lines.
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 0, y: -60 },
              text: "line one\nline two\nline three",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      // First-line baseline = the text element's y.
      const textY = Number(group.find("text").attributes("y"));
      // Label end of the straight connector is the `L` point.
      const d = group.find("path:not(.annotation-outline)").attributes("d")!;
      const labelEndY = Number(d.match(/L[\d.-]+,([\d.-]+)$/)![1]);
      // Endpoint lands below the first line (old behavior put it above).
      expect(labelEndY).toBeGreaterThan(textY);
    });

    it("connects multi-line text below the point to its top edge", () => {
      // Text sits below the anchor (positive y offset): connector ends
      // above the first line, pointing at the top of the block.
      const wrapper = mount(LineChart, {
        props: {
          data: [20, 10, 0],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 0, y: 60 },
              text: "line one\nline two\nline three",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      const textY = Number(group.find("text").attributes("y"));
      const d = group.find("path:not(.annotation-outline)").attributes("d")!;
      const labelEndY = Number(d.match(/L[\d.-]+,([\d.-]+)$/)![1]);
      expect(labelEndY).toBeLessThan(textY);
    });

    it("quarter-arc control X matches start X, end Y matches control Y", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            { x: 1, y: 10, offset: { x: 30, y: -20 }, text: "up-right" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      // Pointer path: `M sx,sy Q cx,cy ex,ey`. The curve emerges from the
      // start (nudged in the offset direction so it doesn't sit on the
      // axis) tangent vertically (cx === sx) and lands on the label
      // horizontally (ey === cy).
      const d = wrapper.find("g.chart-annotations path").attributes("d")!;
      const startMatch = d.match(/^M([\d.-]+),([\d.-]+) /)!;
      const qMatch = d.match(/Q([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)$/)!;
      const sx = Number(startMatch[1]);
      const cx = Number(qMatch[1]);
      const cy = Number(qMatch[2]);
      const ey = Number(qMatch[4]);
      // Control X equals start X → curve emerges from start vertically.
      expect(cx).toBeCloseTo(sx, 1);
      // End Y matches control Y → curve approaches label horizontally.
      expect(ey).toBeCloseTo(cy, 1);
    });

    it('omits the pointer path when pointer is "none"', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -10 },
              text: "no pointer",
              pointer: "none" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      // Annotations group exists, but contains no <path> (pointer omitted).
      const group = wrapper.find("g.chart-annotations");
      expect(group.exists()).toBe(true);
      expect(group.find("path").exists()).toBe(false);
      // Text label still renders.
      expect(group.find("text").text()).toContain("no pointer");
    });

    it("renders the arrow head as an inline polygon with the line color (Safari-safe, no marker)", () => {
      // Safari doesn't implement `context-stroke` on SVG markers, so the
      // arrow must be drawn as an explicit triangle filled with the line
      // color rather than via `<marker>` + `marker-start`.
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 30, y: -20 },
              text: "Peak",
              lineColor: "#ff0000",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      // No <marker> / <defs> for annotations — color would break in Safari.
      expect(group.find("marker").exists()).toBe(false);
      const polygon = group.find("polygon:not(.annotation-outline)");
      expect(polygon.exists()).toBe(true);
      expect(polygon.attributes("fill")).toBe("#ff0000");
      // Triangle pointing along local +x, tip at origin, base 6 back, 6 tall.
      expect(polygon.attributes("points")).toBe("0,0 -6,-3 -6,3");
      // Path is not driving the arrow via marker-start anymore.
      const path = group.find("path:not(.annotation-outline)");
      expect(path.attributes("marker-start")).toBeUndefined();
    });

    it("omits the inline arrow when arrow: false", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 30, y: -20 },
              text: "Peak",
              arrow: false,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      expect(group.find("polygon").exists()).toBe(false);
    });

    it("starts the curved pointer directly above/below the anchor so the arrow lines up", () => {
      // The curved pointer emerges vertically from the anchor; its start X
      // must match the anchor X so the arrow head sits directly on the
      // data point rather than off to one side.
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 5, 10],
          annotations: [
            { x: 0, y: 0, offset: { x: 30, y: -20 }, text: "anchor on axis" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const d = wrapper.find("g.chart-annotations path").attributes("d")!;
      const startMatch = d.match(/^M([\d.-]+),([\d.-]+) /)!;
      const sx = Number(startMatch[1]);
      // padding.left=50 with no yLabel → anchor X is 50. No horizontal nudge.
      expect(sx).toBeCloseTo(50, 0);
    });

    it("supports multi-line text via \\n", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            { x: 1, y: 10, offset: { x: 20, y: 0 }, text: "Line A\nLine B" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const lineTspans = wrapper.findAll("g.chart-annotations text > tspan");
      expect(lineTspans.length).toBe(2);
      expect(lineTspans[0].text()).toBe("Line A");
      expect(lineTspans[1].text()).toBe("Line B");
      // First tspan has dy=0, subsequent tspans advance by ~font-size * 1.2.
      expect(lineTspans[0].attributes("dy")).toBe("0");
      // dy = font-size (13) * line-height (1.2) = 15.6.
      expect(Number(lineTspans[1].attributes("dy"))).toBeCloseTo(15.6, 1);
    });

    it("renders **bold** runs at weight 800", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: 0 },
              text: "Peak: **Day 5**",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const runs = wrapper.findAll("g.chart-annotations text > tspan > tspan");
      expect(runs.length).toBe(2);
      expect(runs[0].text().trim()).toBe("Peak:");
      expect(runs[0].attributes("font-weight")).toBeFalsy();
      expect(runs[1].text()).toBe("Day 5");
      expect(runs[1].attributes("font-weight")).toBe("700");
    });

    it("renders _italic_ runs with font-style: italic", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: 0 },
              text: "say _hello_ world",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const runs = wrapper.findAll("g.chart-annotations text > tspan > tspan");
      const italic = runs.find((r) => r.text() === "hello");
      expect(italic).toBeTruthy();
      expect(italic!.attributes("font-style")).toBe("italic");
    });

    it("composes **_bold italic_**", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            { x: 1, y: 10, offset: { x: 20, y: 0 }, text: "**_both_**" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const runs = wrapper.findAll("g.chart-annotations text > tspan > tspan");
      const both = runs.find((r) => r.text() === "both");
      expect(both).toBeTruthy();
      expect(both!.attributes("font-weight")).toBe("700");
      expect(both!.attributes("font-style")).toBe("italic");
    });

    it("derives text-anchor from offsetX sign", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            { x: 0, y: 0, offset: { x: 30, y: 0 }, text: "right" },
            { x: 1, y: 10, offset: { x: -30, y: 0 }, text: "left" },
            { x: 2, y: 20, offset: { x: 0, y: -20 }, text: "above" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const texts = wrapper.findAll("g.chart-annotations text");
      expect(texts.length).toBe(3);
      expect(texts[0].attributes("text-anchor")).toBe("start");
      expect(texts[1].attributes("text-anchor")).toBe("end");
      expect(texts[2].attributes("text-anchor")).toBe("middle");
    });

    it("respects xMin so annotation x lines up with axis labels", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 5, 10, 15, 20],
          xMin: 100,
          annotations: [
            { x: 102, y: 10, offset: { x: 0, y: 0 }, text: "marker" },
          ],
          height: 200,
          width: 410,
          menu: false,
        },
      });
      // padding.left=50, innerW=410-50-10=350. Internal x = 102 - 100 = 2, range 0..4
      // → pixel = 50 + (2/4)*350 = 225.
      const text = wrapper.find("g.chart-annotations text");
      const x = Number(text.attributes("x"));
      expect(x).toBeCloseTo(225, 0);
    });

    it('pointer: "ruleX" draws a vertical line spanning the plot height', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "vline",
              pointer: "ruleX" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const line = wrapper.find("g.chart-annotations line");
      expect(line.exists()).toBe(true);
      // padding.left=50, innerW=340, x=1 of range [0,2] → 50 + 0.5*340 = 220.
      // padding.top=10, innerH=160 → top=10, bottom=170.
      expect(Number(line.attributes("x1"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("x2"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("y1"))).toBeCloseTo(10, 0);
      expect(Number(line.attributes("y2"))).toBeCloseTo(170, 0);
      // Rule replaces the pointer — no pointer <path> is rendered.
      expect(wrapper.find("g.chart-annotations path").exists()).toBe(false);
      // Label still renders.
      expect(wrapper.find("g.chart-annotations text").text()).toContain(
        "vline",
      );
    });

    it('pointer: "ruleY" draws a horizontal line spanning the plot width', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "hline",
              pointer: "ruleY" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const line = wrapper.find("g.chart-annotations line");
      expect(line.exists()).toBe(true);
      // padding.left=50, innerW=340 → left=50, right=390.
      // padding.top=10, innerH=160, y=10 of range [0,20] → 10 + 160 - 0.5*160 = 90.
      expect(Number(line.attributes("x1"))).toBeCloseTo(50, 0);
      expect(Number(line.attributes("x2"))).toBeCloseTo(390, 0);
      expect(Number(line.attributes("y1"))).toBeCloseTo(90, 0);
      expect(Number(line.attributes("y2"))).toBeCloseTo(90, 0);
    });

    it("rule pointer applies lineColor, lineWidth, and lineDash", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "styled",
              pointer: "ruleX" as const,
              lineColor: "#f00",
              lineWidth: 2,
              lineDash: "4 2",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const line = wrapper.find(
        "g.chart-annotations line:not(.annotation-outline)",
      );
      expect(line.attributes("stroke")).toBe("#f00");
      expect(line.attributes("stroke-width")).toBe("2");
      expect(line.attributes("stroke-dasharray")).toBe("4 2");
    });

    it('pointer: "ruleDown" draws a vertical line from the top edge to the anchor', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "down",
              pointer: "ruleDown" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const line = wrapper.find("g.chart-annotations line");
      // anchor at (220, 90), top of plot at y=10.
      expect(Number(line.attributes("x1"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("y1"))).toBeCloseTo(10, 0);
      expect(Number(line.attributes("x2"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("y2"))).toBeCloseTo(90, 0);
    });

    it('pointer: "ruleUp" draws a vertical line from the bottom edge to the anchor', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "up",
              pointer: "ruleUp" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const line = wrapper.find("g.chart-annotations line");
      // anchor at (220, 90), bottom of plot at y=170.
      expect(Number(line.attributes("x1"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("y1"))).toBeCloseTo(170, 0);
      expect(Number(line.attributes("x2"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("y2"))).toBeCloseTo(90, 0);
    });

    it('pointer: "ruleFromLeft" draws a horizontal line from the left edge to the anchor', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "from left",
              pointer: "ruleFromLeft" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const line = wrapper.find("g.chart-annotations line");
      // anchor at (220, 90), left edge at x=50.
      expect(Number(line.attributes("x1"))).toBeCloseTo(50, 0);
      expect(Number(line.attributes("y1"))).toBeCloseTo(90, 0);
      expect(Number(line.attributes("x2"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("y2"))).toBeCloseTo(90, 0);
    });

    it('pointer: "ruleFromRight" draws a horizontal line from the right edge to the anchor', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "from right",
              pointer: "ruleFromRight" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const line = wrapper.find("g.chart-annotations line");
      // anchor at (220, 90), right edge at x=390.
      expect(Number(line.attributes("x1"))).toBeCloseTo(390, 0);
      expect(Number(line.attributes("y1"))).toBeCloseTo(90, 0);
      expect(Number(line.attributes("x2"))).toBeCloseTo(220, 0);
      expect(Number(line.attributes("y2"))).toBeCloseTo(90, 0);
    });

    it("partial rule pointers omit the pointer path and arrow", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "down",
              pointer: "ruleDown" as const,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      expect(wrapper.find("g.chart-annotations path").exists()).toBe(false);
      expect(wrapper.find("g.chart-annotations line").exists()).toBe(true);
    });

    it("rule pointer lineDash accepts a number (uniform dash/gap)", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "dashed",
              pointer: "ruleX" as const,
              lineDash: 3,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      expect(
        wrapper
          .find("g.chart-annotations line:not(.annotation-outline)")
          .attributes("stroke-dasharray"),
      ).toBe("3 3");
    });

    it("renders multiple annotations", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            { x: 0, y: 0, offset: { x: 10, y: -10 }, text: "A" },
            { x: 1, y: 10, offset: { x: 10, y: -10 }, text: "B" },
            { x: 2, y: 20, offset: { x: 10, y: -10 }, text: "C" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const texts = wrapper.findAll("g.chart-annotations text");
      expect(texts.map((t) => t.text().trim())).toEqual(["A", "B", "C"]);
    });

    it("shrinks the inner plot when chartPadding adds top space", () => {
      // y-tick for the max value sits at the top of the plot. Adding top
      // padding shifts that tick down by exactly the padding amount.
      const baseline = mount(LineChart, {
        props: { data: [0, 10, 20], height: 200, width: 400, menu: false },
      });
      const padded = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          chartPadding: { top: 40 },
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const baselineTopTick = Number(
        baseline.findAll('[data-testid="y-tick"]').at(-1)!.attributes("y"),
      );
      const paddedTopTick = Number(
        padded.findAll('[data-testid="y-tick"]').at(-1)!.attributes("y"),
      );
      expect(paddedTopTick - baselineTopTick).toBeCloseTo(40, 0);
    });

    it("accepts chartPadding as a number (uniform on all sides)", () => {
      const baseline = mount(LineChart, {
        props: { data: [0, 10, 20], height: 200, width: 400, menu: false },
      });
      const padded = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          chartPadding: 20,
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const baselineTopTick = Number(
        baseline.findAll('[data-testid="y-tick"]').at(-1)!.attributes("y"),
      );
      const paddedTopTick = Number(
        padded.findAll('[data-testid="y-tick"]').at(-1)!.attributes("y"),
      );
      expect(paddedTopTick - baselineTopTick).toBeCloseTo(20, 0);
    });

    it("places annotations after the tooltip overlay (top layer)", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          tooltipTrigger: "hover" as const,
          annotations: [
            { x: 1, y: 10, offset: { x: 10, y: -10 }, text: "top" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const svg = wrapper.find("svg").element;
      const overlay = svg.querySelector('rect[fill="transparent"]');
      const annotations = svg.querySelector("g.chart-annotations");
      expect(overlay).toBeTruthy();
      expect(annotations).toBeTruthy();
      const overlayPos = Array.from(svg.children).indexOf(overlay!);
      const annotationsPos = Array.from(svg.children).indexOf(annotations!);
      expect(annotationsPos).toBeGreaterThan(overlayPos);
    });
  });

  describe("yScaleType: log", () => {
    it("renders powers-of-10 ticks by default", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 10, 100, 1000],
          yScaleType: "log",
          width: 400,
          height: 240,
          menu: false,
        },
      });
      const tickLabels = wrapper
        .findAll('[data-testid="y-tick"]')
        .map((t) => t.text());
      // formatTick adds thousands separators at >= 1000.
      expect(tickLabels).toEqual(["1", "10", "100", "1,000"]);
    });

    it("maps a midpoint value to the geometric midpoint of the axis", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 10, 100],
          yScaleType: "log",
          width: 400,
          height: 240,
          menu: false,
        },
      });
      const ticks = wrapper.findAll('[data-testid="y-tick"]');
      const tickYs = ticks.map((t) => Number(t.attributes("y")));
      // 1, 10, 100 → 0, 0.5, 1 of the axis range. Verify the middle tick
      // sits halfway between the outer ticks.
      const [yTop, yMid, yBot] = [tickYs[2], tickYs[1], tickYs[0]];
      const midpoint = (yTop + yBot) / 2;
      expect(yMid).toBeCloseTo(midpoint, 0);
    });

    it("ignores yMin <= 0 in log mode", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 10, 100],
          yMin: 0,
          yScaleType: "log",
          width: 400,
          height: 240,
          menu: false,
        },
      });
      // No NaN/Infinity in the path d attribute.
      const paths = wrapper.findAll("path");
      const d = paths[paths.length - 1].attributes("d") ?? "";
      expect(d).toBeTruthy();
      expect(d).not.toMatch(/NaN|Infinity/);
    });

    it("honors explicit yTicks array in log mode", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 10, 100],
          yScaleType: "log",
          yTicks: [2, 5, 50],
          width: 400,
          height: 240,
          menu: false,
        },
      });
      const tickLabels = wrapper
        .findAll('[data-testid="y-tick"]')
        .map((t) => t.text());
      expect(tickLabels).toEqual(["2", "5", "50"]);
    });
  });

  describe("date axis", () => {
    it("auto-detects a date axis when every x value is a date string", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [10, 20, 30, 40],
          x: ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"],
          width: 600,
          height: 200,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="x-tick"]')
        .map((t) => t.text());
      // Default month-anchored formatting includes month names.
      expect(labels.join(" ")).toMatch(/Jan|Feb|Mar|Apr/);
      // No raw epoch-ms numbers should leak into the label text.
      for (const l of labels) expect(l).not.toMatch(/\d{10,}/);
    });

    it("does not auto-detect on a purely numeric x array", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [10, 20, 30, 40],
          x: [0, 1, 2, 3],
          width: 600,
          height: 200,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="x-tick"]')
        .map((t) => t.text());
      // Numeric formatter would render plain integers, not month names.
      for (const l of labels) expect(l).not.toMatch(/Jan|Feb|Mar|Apr/);
    });

    it('xTickFormat: "iso" overrides the default unit-aware formatter', () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [10, 20, 30, 40],
          x: ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"],
          xTickFormat: "iso",
          width: 600,
          height: 200,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="x-tick"]')
        .map((t) => t.text());
      for (const l of labels) {
        expect(l).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("custom xTickFormat function receives epoch-ms", () => {
      const seen: number[] = [];
      mount(LineChart, {
        props: {
          data: [10, 20, 30],
          x: ["2026-01-01", "2026-02-01", "2026-03-01"],
          xTickFormat: (v: number) => {
            seen.push(v);
            return String(v);
          },
          width: 600,
          height: 200,
          menu: false,
        },
      });
      expect(seen.length).toBeGreaterThan(0);
      // Epoch-ms for 2020+ is well over 1e12.
      for (const v of seen) expect(v).toBeGreaterThan(1e12);
    });

    it('timezone: "local" parses bare YYYY-MM-DD against local midnight', () => {
      const utcWrapper = mount(LineChart, {
        props: {
          data: [10, 20],
          x: ["2026-01-15", "2026-02-15"],
          xTickFormat: "iso-datetime",
          timezone: "utc",
          width: 600,
          height: 200,
          menu: false,
          xTicks: [Date.UTC(2026, 0, 15), Date.UTC(2026, 1, 15)],
        },
      });
      const localWrapper = mount(LineChart, {
        props: {
          data: [10, 20],
          x: ["2026-01-15", "2026-02-15"],
          xTickFormat: "iso-datetime",
          timezone: "local",
          width: 600,
          height: 200,
          menu: false,
          xTicks: [
            new Date(2026, 0, 15).getTime(),
            new Date(2026, 1, 15).getTime(),
          ],
        },
      });
      const utcLabels = utcWrapper
        .findAll('[data-testid="x-tick"]')
        .map((t) => t.text());
      const localLabels = localWrapper
        .findAll('[data-testid="x-tick"]')
        .map((t) => t.text());
      // UTC renders explicit Z suffix; local renders without it.
      expect(utcLabels.every((l) => l.endsWith("Z"))).toBe(true);
      expect(localLabels.every((l) => !l.endsWith("Z"))).toBe(true);
    });

    it("tooltip label renders the hovered date on a date axis", async () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [10, 20, 30],
          x: ["2026-01-01", "2026-02-01", "2026-03-01"],
          tooltipTrigger: "hover" as const,
          width: 600,
          height: 200,
          menu: false,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 30, clientY: 100 });
      const tip = wrapper.find(".line-chart-tooltip-label");
      expect(tip.exists()).toBe(true);
      // Default ISO format ⇒ "2026-01-01".
      expect(tip.text()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      wrapper.unmount();
    });
  });
});
