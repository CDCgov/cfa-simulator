import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import LineChart from "./LineChart.vue";
import type { ChartAnnotation } from "../_shared/annotations.js";
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
      const label = wrapper.find(".chart-tooltip-label");
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
      const row = wrapper.find(".chart-tooltip-row");
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
      expect(wrapper.findAll(".chart-tooltip-row").length).toBe(1);
      // Hover dot is also suppressed for the hidden series. Hover dots have
      // a white stroke; other circles (e.g. series dots) do not.
      const hoverDots = wrapper
        .findAll("circle")
        .filter((c) => c.attributes("stroke-width") === "2");
      expect(hoverDots.length).toBe(1);
      wrapper.unmount();
    });

    async function hoverMiddle(props: Record<string, unknown>) {
      const wrapper = mount(LineChart, {
        props: {
          width: 400,
          height: 200,
          menu: false,
          tooltipTrigger: "hover" as const,
          ...props,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
      return wrapper;
    }

    it("names tooltip rows after the series legend or tooltipLabel", async () => {
      const wrapper = await hoverMiddle({
        series: [
          { data: [1, 2, 3], legend: "Cases", color: "#0057b7" },
          { data: [4, 5, 6], tooltipLabel: "Median", color: "#f4a261" },
        ],
      });
      const names = wrapper.findAll(".chart-tooltip-name").map((n) => n.text());
      expect(names).toEqual(["Cases", "Median"]);
      wrapper.unmount();
    });

    it("drops unnamed series from the tooltip once any row is named", async () => {
      const wrapper = await hoverMiddle({
        series: [
          { data: [1, 2, 3], color: "#ccc" },
          { data: [2, 3, 4], color: "#ccc" },
          { data: [1.5, 2.5, 3.5], legend: "Median", color: "#0057b7" },
        ],
      });
      const rows = wrapper.findAll(".chart-tooltip-row");
      expect(rows.length).toBe(1);
      expect(rows[0].text()).toBe("Median2.5");
      wrapper.unmount();
    });

    it("keeps unnamed rows when no series is named", async () => {
      const wrapper = await hoverMiddle({
        series: [{ data: [1, 2, 3] }, { data: [4, 5, 6] }],
      });
      expect(wrapper.findAll(".chart-tooltip-row").length).toBe(2);
      expect(wrapper.find(".chart-tooltip-name").exists()).toBe(false);
      wrapper.unmount();
    });

    it("shows named areas as ranges at the hovered x", async () => {
      const wrapper = await hoverMiddle({
        series: [{ data: [1, 2, 3], legend: "Median" }],
        areas: [
          { lower: [0, 1, 2], upper: [2, 4, 6], legend: "95% CI" },
          { lower: [0, 1, 2], upper: [3, 3, 3] },
          {
            lower: [0, 1, 2],
            upper: [2, 4, 6],
            legend: "Hidden",
            showInTooltip: false,
          },
        ],
      });
      const rows = wrapper.findAll(".chart-tooltip-row").map((r) => r.text());
      expect(rows).toEqual(["Median2", "95% CI1–4"]);
      wrapper.unmount();
    });

    it("names an area row with tooltipLabel and no legend entry", async () => {
      const wrapper = await hoverMiddle({
        series: [{ data: [1, 2, 3], legend: "Median" }],
        areas: [{ lower: [0, 1, 2], upper: [2, 4, 6], tooltipLabel: "95% CI" }],
      });
      const rows = wrapper.findAll(".chart-tooltip-row").map((r) => r.text());
      expect(rows).toEqual(["Median2", "95% CI1–4"]);
      const svgText = wrapper.findAll("text").map((t) => t.text());
      expect(svgText).toContain("Median");
      expect(svgText).not.toContain("95% CI");
      wrapper.unmount();
    });

    it("leaves out rows with no value at the hovered x", async () => {
      const wrapper = await hoverMiddle({
        series: [
          { data: [1, 2, 3], legend: "Model" },
          { data: [1, NaN, 3], legend: "Observed" },
        ],
      });
      const names = wrapper.findAll(".chart-tooltip-name").map((n) => n.text());
      expect(names).toEqual(["Model"]);
      wrapper.unmount();
    });

    it("leaves out an area that does not cover the hovered x", async () => {
      const wrapper = await hoverMiddle({
        series: [{ x: [0, 1, 2, 3, 4], data: [1, 2, 3, 4, 5], legend: "Obs" }],
        areas: [
          { x: [3, 4], lower: [3, 4], upper: [5, 6], legend: "Forecast" },
        ],
      });
      const names = wrapper.findAll(".chart-tooltip-name").map((n) => n.text());
      expect(names).toEqual(["Obs"]);
      wrapper.unmount();
    });

    it("formats the heading with tooltipTitle", async () => {
      const wrapper = await hoverMiddle({
        data: [1, 2, 3],
        tooltipTitle: (label: string, index: number) =>
          `Day ${label} (#${index})`,
      });
      expect(wrapper.find(".chart-tooltip-label").text()).toBe("Day 1 (#1)");
      wrapper.unmount();
    });

    it("passes title, format, labels and areas to the tooltip slot", async () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [1000, 2000, 3000], legend: "Cases" }],
          areas: [{ lower: [0, 1500, 0], upper: [0, 2500, 0], legend: "CI" }],
          tooltipValueFormat: (v: number) => `$${v}`,
          tooltipTitle: (label: string) => `Day ${label}`,
          width: 400,
          height: 200,
          menu: false,
          tooltipTrigger: "hover" as const,
        },
        slots: {
          tooltip: `
            <template #default="p">
              <div data-testid="slot">{{ p.title }}|{{ p.values[0].label }}|{{ p.format(p.values[0].value) }}|{{ p.areas[0].label }}</div>
            </template>
          `,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
      expect(wrapper.find('[data-testid="slot"]').text()).toBe(
        "Day 1|Cases|$2000|CI",
      );
      wrapper.unmount();
    });

    it("anchors the tooltip to the union of x values across series", async () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [
            { x: [0, 10, 20], data: [1, 2, 3], color: "#0057b7" },
            { x: [5, 15, 25], data: [4, 5, 6], color: "#f4a261" },
            { x: [2, 12], data: [7, 8], showInTooltip: false },
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
      const labels = new Set<string>();
      const indices = new Set<number>();
      for (let clientX = 0; clientX <= 400; clientX += 4) {
        await overlay.trigger("mousemove", { clientX, clientY: 50 });
        labels.add(wrapper.find(".chart-tooltip-label").text());
        indices.add(
          (wrapper.emitted("hover")!.at(-1)![0] as { index: number }).index,
        );
      }
      expect([...labels]).toEqual(["0", "5", "10", "15", "20", "25"]);
      expect([...indices].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
      // Every series still reports its nearest point at a union position.
      expect(wrapper.findAll(".chart-tooltip-row").length).toBe(2);
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

    it("renders an area legend entry with a filled swatch", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          areas: [
            {
              upper: [2, 3, 4],
              lower: [0, 1, 2],
              color: "#0057b7",
              opacity: 0.15,
              legend: "95% interval",
            },
          ],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text").map((t) => t.text());
      expect(texts).toContain("95% interval");
      const swatch = wrapper
        .findAll("rect")
        .find(
          (r) =>
            r.attributes("fill") === "#0057b7" &&
            r.attributes("fill-opacity") === "0.15" &&
            r.attributes("width") === "12" &&
            r.attributes("height") === "8",
        );
      expect(swatch).toBeTruthy();
    });

    it("hides an area legend entry when showInLegend is false", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          areas: [
            {
              upper: [2, 3, 4],
              lower: [0, 1, 2],
              legend: "Hidden interval",
              showInLegend: false,
            },
          ],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text").map((t) => t.text());
      expect(texts).not.toContain("Hidden interval");
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
      const row = wrapper.find(".chart-tooltip-row");
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

    it("draws no boundary lines or bar for an unlabeled series section", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30] }],
          areaSections: [{ seriesIndex: 0, startIndex: 1, endIndex: 3 }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      // Only the two axis lines.
      expect(wrapper.findAll("line").length).toBe(2);
      expect(wrapper.find('[data-testid="section-bar"]').exists()).toBe(false);
    });

    it("extends a labeled section's fill past the axis to a bar", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30] }],
          areaSections: [
            { seriesIndex: 0, startIndex: 1, endIndex: 3, label: "Phase" },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      // Bar sits 26px under the plot bottom (170), past the tick labels.
      const bar = wrapper.find('[data-testid="section-bar"]');
      expect(bar.exists()).toBe(true);
      expect(bar.attributes("y1")).toBe("196");
      expect(bar.attributes("y2")).toBe("196");
      // The fill closes at the bar, not the plot bottom.
      const fill = wrapper.find('[data-testid="section-fill"]');
      expect(fill.attributes("d")).toContain(",196");
      expect(fill.attributes("d")).not.toContain(",170");
    });

    it("keeps an unlabeled section's fill inside the plot", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30] }],
          areaSections: [
            {
              seriesIndex: 0,
              startIndex: 1,
              endIndex: 3,
              legend: "inline",
              label: "Phase",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const fill = wrapper.find('[data-testid="section-fill"]');
      expect(fill.attributes("d")).toContain(",170");
      expect(wrapper.find('[data-testid="section-bar"]').exists()).toBe(false);
    });

    it("styles the highlighted line and bar independently of the fill", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30] }],
          areaSections: [
            {
              seriesIndex: 0,
              startIndex: 1,
              endIndex: 3,
              color: "#ff0000",
              lineColor: "#00ff00",
              strokeWidth: 3,
              label: "Phase",
              barColor: "#0000ff",
              barWidth: 2,
              barOpacity: 1,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const fill = wrapper.find('[data-testid="section-fill"]');
      expect(fill.attributes("fill")).toBe("#ff0000");
      const line = wrapper
        .findAll("path")
        .find((p) => p.attributes("stroke") === "#00ff00")!;
      expect(line.attributes("stroke-width")).toBe("3");
      const bar = wrapper.find('[data-testid="section-bar"]');
      expect(bar.attributes("stroke")).toBe("#0000ff");
      expect(bar.attributes("stroke-width")).toBe("2");
      expect(bar.attributes("stroke-opacity")).toBe("1");
    });

    it("applies areaSectionLayout spacing", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30, 40] }],
          areaSections: [
            { startIndex: 0, endIndex: 2, label: "First section label" },
            { startIndex: 1, endIndex: 3, label: "Second section label" },
          ],
          areaSectionLayout: { barOffset: 40, labelGap: 10, rowHeight: 50 },
          height: 200,
          width: 300,
          menu: false,
        },
      });
      // Plot bottom is 170; the bar moves to 170 + 40.
      const bar = wrapper.find('[data-testid="section-bar"]');
      expect(bar.attributes("y1")).toBe("210");
      const fill = wrapper.find('[data-testid="section-fill"]');
      expect(fill.attributes("d")).toContain(",210");
      // First row label baseline: bar + gap + 10; second row one rowHeight lower.
      const ys = wrapper
        .findAll('[data-testid="section-label"] text')
        .map((t) => Number(t.attributes("y")));
      expect(ys).toEqual([230, 280]);
      // svg grows to fit both rows: 210 + 10 + 2 * 50.
      expect(wrapper.find("svg").attributes("height")).toBe("320");
    });

    it("moves the x-axis label to the left of the first section label row", () => {
      const props = {
        series: [{ data: [0, 10, 20] }],
        xLabel: "Days",
        height: 200,
        width: 400,
        menu: false,
      };
      const plain = mount(LineChart, { props });
      const labeled = mount(LineChart, {
        props: {
          ...props,
          areaSections: [{ startIndex: 1, endIndex: 2, label: "Phase" }],
        },
      });
      const xLabelEl = (w: ReturnType<typeof mount>) =>
        w.findAll("text").filter((t) => t.text() === "Days");
      expect(xLabelEl(plain)).toHaveLength(1);
      expect(Number(xLabelEl(plain)[0].attributes("y"))).toBe(196);
      // Centered under the plot without section labels.
      expect(xLabelEl(plain)[0].attributes("text-anchor")).toBe("middle");
      expect(Number(xLabelEl(plain)[0].attributes("x"))).toBe(220);
      // Only the section-row copy renders (the centered one is dropped).
      const labeledEls = xLabelEl(labeled);
      expect(labeledEls).toHaveLength(1);
      const el = labeledEls[0];
      expect(el.attributes("text-anchor")).toBe("start");
      expect(Number(el.attributes("x"))).toBe(50);
      // Same baseline as the first-row section label. With an x label the
      // bottom padding is 38: plot bottom 162, bar 188, then 6 gap + 10.
      expect(Number(el.attributes("y"))).toBe(204);
      const sectionText = labeled.find('[data-testid="section-label"] text');
      expect(sectionText.attributes("y")).toBe("204");
      expect(sectionText.attributes("x")).toBe("220");
      // One row of labels: 188 + 6 + 32, no extra room reserved under it.
      expect(labeled.find("svg").attributes("height")).toBe("226");
    });

    it("left-aligns the x-axis label without sections when asked", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          xLabel: "Days",
          xLabelAlign: "left",
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const el = wrapper.findAll("text").find((t) => t.text() === "Days")!;
      expect(el.attributes("text-anchor")).toBe("start");
      expect(Number(el.attributes("x"))).toBe(50);
      expect(Number(el.attributes("y"))).toBe(196);
    });

    it("centers the x-axis label under the section rows with xLabelAlign center", () => {
      const props = {
        series: [{ data: [0, 10, 20] }],
        xLabel: "Days",
        xLabelAlign: "center" as const,
        height: 200,
        width: 400,
        menu: false,
      };
      const plain = mount(LineChart, { props });
      const plainEl = plain.findAll("text").find((t) => t.text() === "Days")!;
      expect(plainEl.attributes("text-anchor")).toBe("middle");
      // padding.left 50 + innerW 340 / 2
      expect(Number(plainEl.attributes("x"))).toBe(220);
      const labeled = mount(LineChart, {
        props: {
          ...props,
          areaSections: [{ startIndex: 0, endIndex: 2, label: "Phase" }],
        },
      });
      const el = labeled.findAll("text").find((t) => t.text() === "Days")!;
      expect(el.attributes("text-anchor")).toBe("middle");
      const svgH = Number(labeled.find("svg").attributes("height"));
      expect(Number(el.attributes("y"))).toBe(svgH - 4);
      // Rows end at 226; font size 13 + 8 gap reserved beneath for the label.
      expect(svgH).toBe(247);
      // The section label keeps the first row: nothing to collide with.
      const sectionText = labeled.find('[data-testid="section-label"] text');
      expect(sectionText.attributes("y")).toBe("204");
    });

    it("drops the bar and label of a section hidden with its series", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20, 30], legend: "A" }],
          areaSections: [
            { seriesIndex: 0, startIndex: 1, endIndex: 3, label: "Phase" },
          ],
          legendToggle: true,
          hiddenSeries: ["A"],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      expect(wrapper.find('[data-testid="section-fill"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="section-bar"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="section-label"]').exists()).toBe(
        false,
      );
      expect(wrapper.find("svg").attributes("height")).toBe("200");
    });

    it("scales the collision estimate with the label font size", () => {
      const base = {
        series: [{ data: [0, 10, 20, 30, 40] }],
        height: 200,
        width: 400,
        menu: false,
      };
      // Second section starts 85px right of the first (innerW 340 / 4).
      // At 11px the first label (~70px) clears it; at 22px (~140px) it
      // collides and the second drops a row.
      const rows = (fontSize: number) =>
        mount(LineChart, {
          props: {
            ...base,
            areaSections: [
              {
                startIndex: 0,
                endIndex: 1,
                label: "Phase one",
                inlineLabelStyle: { fontSize },
              },
              { startIndex: 1, endIndex: 2, label: "Phase two" },
            ],
          },
        })
          .findAll('[data-testid="section-label"] text')
          .map((t) => t.attributes("y"));
      const small = rows(11);
      expect(small[0]).toBe(small[1]);
      const large = rows(22);
      expect(large[0]).not.toBe(large[1]);
    });

    it("pushes a section label that would overlap the x-axis label down a row", () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [{ data: [0, 10, 20] }],
          xLabel: "Days",
          areaSections: [{ startIndex: 0, endIndex: 2, label: "Phase" }],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const sectionText = wrapper.find('[data-testid="section-label"] text');
      expect(sectionText.attributes("x")).toBe("50");
      // Second row: 204 + 32.
      expect(sectionText.attributes("y")).toBe("236");
      expect(wrapper.find("svg").attributes("height")).toBe("258");
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
      const labelGroups = wrapper.findAll('[data-testid="section-label"]');
      expect(labelGroups.length).toBe(2);
      // They should have different y positions for their text
      const labelTexts = labelGroups.map((g) =>
        g.find("text").attributes("y")!,
      );
      expect(labelTexts[0]).not.toBe(labelTexts[1]);
    });

    it("anchors the label text and bar to the section start", () => {
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
      // xPixel(1) with range 0..2 = 50 + 0.5 * 340 = 220 (bar is pixel-snapped)
      const bar = wrapper.find('[data-testid="section-bar"]');
      expect(bar.attributes("x1")).toBe("220.5");
      expect(bar.attributes("x2")).toBe("390.5");
      const text = wrapper.find('[data-testid="section-label"] text');
      expect(Number(text.attributes("x"))).toBeCloseTo(220, 0);
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
      // textWidth = 40 * 7 = 280; the section starts at 390 → overflow.
      // Clamped: x = 390 - 280 - 8 = 102, so the text ends 8px inside the edge.
      const labelGroups = wrapper.findAll('[data-testid="section-label"]');
      expect(labelGroups.length).toBe(1);
      const textEl = labelGroups[0].findAll("text")[0];
      const textX = Number(textEl.attributes("x"));
      const textWidth = longLabel.length * 7;
      const textRight = textX + textWidth;
      expect(textRight).toBeLessThanOrEqual(390);
      expect(textRight).toBeCloseTo(382, 0);
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

    it("styles the text outline apart from the line outline", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 10,
              offset: { x: 30, y: -20 },
              text: "Peak",
              outlineColor: "#fff",
              outlineWidth: 4,
              textOutlineColor: "#000",
              textOutlineWidth: 1,
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      expect(group.find("path.annotation-outline").attributes("stroke")).toBe(
        "#fff",
      );
      const text = group.find("text");
      expect(text.attributes("stroke")).toBe("#000");
      expect(text.attributes("stroke-width")).toBe("1");
    });

    it("rotates the label about its position and blends the annotation", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          annotations: [
            {
              x: 1,
              y: 0,
              offset: { x: 6, y: -8 },
              text: "Peak",
              pointer: "ruleX",
              rotate: -90,
              blendMode: "multiply",
            },
          ],
          height: 200,
          width: 400,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      const item = group.find("g");
      expect(item.attributes("style")).toContain("mix-blend-mode: multiply");
      const text = group.find("text");
      const x = text.attributes("x");
      const y = text.attributes("y");
      expect(text.attributes("transform")).toBe(`rotate(-90 ${x} ${y})`);
      // Offset to the right of the rule: the glyph body would extend back
      // across it, so the text hangs from its baseline instead.
      expect(text.attributes("dominant-baseline")).toBe("hanging");
      // WebKit only honors the baseline on the tspan holding the glyphs.
      expect(text.find("tspan tspan").attributes("dominant-baseline")).toBe(
        "hanging",
      );
    });

    it("keeps rotated text on the far side of its position from the anchor", () => {
      const base = { x: 1, y: 0, text: "A\nB", pointer: "ruleX" as const };
      const mountWith = (annotation: ChartAnnotation) =>
        mount(LineChart, {
          props: {
            data: [0, 10, 20],
            annotations: [annotation],
            height: 200,
            width: 400,
            menu: false,
          },
        }).find("g.chart-annotations text");
      const left = mountWith({
        ...base,
        offset: { x: -6, y: -8 },
        rotate: -90,
      });
      expect(left.attributes("dominant-baseline")).toBeUndefined();
      // Two lines stack toward the rule, so the block shifts up one line
      // height (13 * 1.2) and its last line sits on the baseline.
      const single = mountWith({
        ...base,
        text: "A",
        offset: { x: -6, y: -8 },
        rotate: -90,
      });
      expect(
        Number(single.attributes("y")) - Number(left.attributes("y")),
      ).toBeCloseTo(13 * 1.2);
      const unrotated = mountWith({ ...base, offset: { x: 6, y: -8 } });
      expect(unrotated.attributes("dominant-baseline")).toBeUndefined();
      expect(unrotated.attributes("transform")).toBeUndefined();
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

    it("aims a curved pointer's arrow along the curve, not the vertical tangent", () => {
      const angleFor = (offset: { x: number; y: number }) => {
        const wrapper = mount(LineChart, {
          props: {
            data: [0, 10, 20],
            annotations: [{ x: 1, y: 10, offset, text: "Peak" }],
            height: 200,
            width: 400,
            menu: false,
          },
        });
        const transform = wrapper
          .find("g.chart-annotations polygon:not(.annotation-outline)")
          .attributes("transform")!;
        return Number(/rotate\((-?[\d.]+)\)/.exec(transform)![1]);
      };
      // Label above-right: the curve rises then turns right, so the head
      // points down and a little left, between the tangent (90) and the
      // chord to the label.
      const tight = angleFor({ x: 60, y: -20 });
      expect(tight).toBeGreaterThan(90);
      expect(tight).toBeLessThan(180);
      // A taller curve leaves the head closer to vertical.
      const tall = angleFor({ x: 60, y: -120 });
      expect(tall).toBeGreaterThan(90);
      expect(tall).toBeLessThan(tight);
      // Label below-right: head points up and a little left.
      const below = angleFor({ x: 60, y: 40 });
      expect(below).toBeLessThan(-90);
      expect(below).toBeGreaterThan(-180);
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

    it("extends the y axis to yMin and yMax without clipping", () => {
      const ticks = (w: ReturnType<typeof mount>) =>
        w
          .findAll('[data-testid="y-tick"]')
          .map((t) => Number(t.text().replace(/,/g, "")));
      const base = { data: [2, 5, 8], width: 400, height: 240, menu: false };
      const wide = mount(LineChart, { props: { ...base, yMin: 0, yMax: 20 } });
      expect(Math.min(...ticks(wide))).toBe(0);
      expect(Math.max(...ticks(wide))).toBe(20);
      const inside = mount(LineChart, { props: { ...base, yMax: 4 } });
      expect(Math.max(...ticks(inside))).toBeGreaterThanOrEqual(8);
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
      const tip = wrapper.find(".chart-tooltip-label");
      expect(tip.exists()).toBe(true);
      // Default ISO format ⇒ "2026-01-01".
      expect(tip.text()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      wrapper.unmount();
    });
  });

  describe("accessibility", () => {
    // The chart's own <svg> is a direct child of the wrapper; scope past the
    // ChartMenu's icon <svg> (which renders first).
    const chartSvg = (wrapper: ReturnType<typeof mount>) =>
      wrapper.find(".line-chart-wrapper").element.querySelector(":scope > svg");

    it("has no role or aria-label on the svg when unlabeled", () => {
      const wrapper = mount(LineChart, { props: { data: [1, 2, 3] } });
      const svg = chartSvg(wrapper);
      expect(svg?.getAttribute("role")).toBeNull();
      expect(svg?.getAttribute("aria-label")).toBeNull();
    });

    it("labels the svg as an image using the title by default", () => {
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], title: "Cases over time" },
      });
      const svg = chartSvg(wrapper);
      expect(svg?.getAttribute("role")).toBe("img");
      expect(svg?.getAttribute("aria-label")).toBe("Cases over time");
    });

    it("prefers ariaLabel over title for the accessible name", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [1, 2, 3],
          title: "Cases",
          ariaLabel: "Line chart of weekly cases, rising then falling",
        },
      });
      expect(chartSvg(wrapper)?.getAttribute("aria-label")).toBe(
        "Line chart of weekly cases, rising then falling",
      );
    });

    it("honors an explicit role override", () => {
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], title: "Cases", role: "figure" },
      });
      expect(chartSvg(wrapper)?.getAttribute("role")).toBe("figure");
    });
  });

  describe("title", () => {
    // width 400, no yLabel → padding.left 50, right 10 → innerW 340,
    // so bounds.left 50, bounds.right 390, center 220.
    const base = { data: [1, 2, 3], width: 400, height: 200, menu: false };

    const titleEl = (wrapper: ReturnType<typeof mount>) =>
      wrapper.find("svg text").element;

    it("renders left-aligned at the plot's left edge with defaults", () => {
      const wrapper = mount(LineChart, { props: { ...base, title: "T" } });
      const t = titleEl(wrapper);
      expect(t.getAttribute("x")).toBe("50");
      expect(t.getAttribute("y")).toBe("18");
      expect(t.getAttribute("text-anchor")).toBe("start");
      expect(t.getAttribute("font-size")).toBe("14");
      expect(t.getAttribute("font-weight")).toBe("600");
      expect(t.getAttribute("fill")).toBe("currentColor");
    });

    it("centers and right-aligns against the plot bounds", () => {
      const center = mount(LineChart, {
        props: { ...base, title: "T", titleStyle: { align: "center" } },
      });
      expect(titleEl(center).getAttribute("x")).toBe("220");
      expect(titleEl(center).getAttribute("text-anchor")).toBe("middle");
      const right = mount(LineChart, {
        props: { ...base, title: "T", titleStyle: { align: "right" } },
      });
      expect(titleEl(right).getAttribute("x")).toBe("390");
      expect(titleEl(right).getAttribute("text-anchor")).toBe("end");
    });

    it("renders multi-line titles with custom style", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...base,
          title: "A\nB\nC",
          titleStyle: {
            fontSize: 16,
            lineHeight: 22,
            color: "#123456",
            fontWeight: 700,
          },
        },
      });
      const t = titleEl(wrapper);
      expect(t.getAttribute("y")).toBe("22");
      expect(t.getAttribute("font-size")).toBe("16");
      expect(t.getAttribute("font-weight")).toBe("700");
      expect(t.getAttribute("fill")).toBe("#123456");
      const tspans = Array.from(t.querySelectorAll("tspan"));
      expect(tspans.map((s) => s.textContent?.trim())).toEqual(["A", "B", "C"]);
      expect(tspans.map((s) => s.getAttribute("dy"))).toEqual([
        "0",
        "22",
        "22",
      ]);
      expect(tspans.every((s) => s.getAttribute("x") === "50")).toBe(true);
    });
  });

  describe("markers", () => {
    // width 600, no yLabel → padding.left 50, right 10 → innerW 540.
    // Markers with labels reserve top room of markerLabelGap (7) +
    // label font size (12) → padding.top 10 + 19 = 29. height 300 →
    // innerH 241, plot bottom 270. Data extent x: 0..10.
    const baseProps = {
      data: [0, 2, 4, 6, 8, 10, 8, 6, 4, 2, 0],
      width: 600,
      height: 300,
      menu: false,
    };

    it("starts a lower-row label's line under its text", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [
            { x: 5, label: "Alpha" },
            { x: 5.2, label: "Beta" },
          ],
        },
      });
      const labels = wrapper.findAll('[data-testid="marker-label"]');
      const lines = wrapper.findAll('[data-testid="marker-line"]');
      // Row 0 keeps the gap above the plot top (29).
      expect(labels[0].attributes("y")).toBe("22");
      expect(lines[0].attributes("y1")).toBe("29");
      // Row 1 drops 15px into the plot; its line begins 3px below the
      // baseline (12 * 0.25) instead of at the plot top.
      expect(labels[1].attributes("y")).toBe("37");
      expect(lines[1].attributes("y1")).toBe("40");
    });

    it("draws a label pill on the line, flat on the line side", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [
            { x: 5, label: "Peak", color: "#0057b7", labelBackground: true },
          ],
        },
      });
      const pill = wrapper.find('[data-testid="marker-label-bg"]');
      expect(pill.attributes("fill")).toBe("#0057b7");
      // Flat edge on the line at x=320, rounded corners on the far side.
      const d = pill.attributes("d")!;
      // The pill is flush with the line's outer edge (320 - 1.5 / 2).
      expect(d.startsWith("M319.25,")).toBe(true);
      expect(d.endsWith("L319.25,29 Z")).toBe(true);
      expect(d.match(/A/g)?.length).toBe(2);
      // Text is inset from the line, light on the dark fill, no halo.
      const label = wrapper.find('[data-testid="marker-label"]');
      expect(label.attributes("x")).toBe("325.25");
      expect(label.attributes("fill")).toBe("#ffffff");
      expect(label.attributes("stroke-width")).toBe("0");
      // The pill reserves cap height 9 + padding 5 above the baseline, so the
      // plot top is 10 + 7 + 14 = 31 and the baseline 24; the line runs up
      // to the pill bottom (24 + 5 = 29).
      const line = wrapper.find('[data-testid="marker-line"]');
      expect(line.attributes("y1")).toBe("29");
      expect(line.attributes("y2")).toBe("270");
    });

    it("sizes the pill from labelPadding and reserves top room for it", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [
            {
              x: 5,
              label: "Peak",
              labelBackground: true,
              labelPadding: { x: 10, y: 6 },
            },
          ],
        },
      });
      // Reserved top = gap 7 + max(12, cap 9 + pad 6 = 15) → plot top 10 + 22 = 32.
      const label = wrapper.find('[data-testid="marker-label"]');
      expect(label.attributes("x")).toBe("329.25");
      expect(label.attributes("y")).toBe("25");
      const d = wrapper
        .find('[data-testid="marker-label-bg"]')
        .attributes("d")!;
      // Bottom = 25 + 6 = 31, height = 9 + 12 → top 10, the svg edge.
      expect(d.startsWith("M319.25,10 ")).toBe(true);
      expect(d.endsWith("L319.25,31 Z")).toBe(true);
      expect(wrapper.find('[data-testid="marker-line"]').attributes("y1")).toBe(
        "31",
      );
    });

    it("fills the pill with a given color and keeps an explicit text color", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [
            {
              x: 9.8,
              label: "A long marker label",
              labelBackground: "#fde68a",
              labelStyle: { color: "#123456" },
            },
          ],
        },
      });
      const pill = wrapper.find('[data-testid="marker-label-bg"]');
      expect(pill.attributes("fill")).toBe("#fde68a");
      const label = wrapper.find('[data-testid="marker-label"]');
      expect(label.attributes("fill")).toBe("#123456");
      // Near the right edge the label flips left of the line and the pill
      // extends leftward from it.
      expect(label.attributes("text-anchor")).toBe("end");
      const lineX = Number(
        wrapper.find('[data-testid="marker-line"]').attributes("x1"),
      );
      expect(Number(label.attributes("x"))).toBe(lineX + 0.75 - 6);
      expect(pill.attributes("d")!.startsWith(`M${lineX + 0.75},`)).toBe(true);
    });

    it("renders a full-height dashed line with a halo'd label above the plot", () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: 5, label: "Isolation" }] },
      });
      const line = wrapper.find('[data-testid="marker-line"]');
      expect(line.attributes("x1")).toBe("320");
      expect(line.attributes("y1")).toBe("29");
      expect(line.attributes("y2")).toBe("270");
      expect(line.attributes("stroke")).toBe("#999");
      expect(line.attributes("stroke-width")).toBe("1.5");
      expect(line.attributes("stroke-dasharray")).toBe("4 4");

      const label = wrapper.find('[data-testid="marker-label"]');
      expect(label.text()).toBe("Isolation");
      // left edge aligned over the line
      expect(label.attributes("x")).toBe("319.25");
      // baseline sits markerLabelGap above the top of the line (29 - 7)
      expect(label.attributes("y")).toBe("22");
      expect(label.attributes("text-anchor")).toBe("start");
      expect(label.attributes("stroke")).toBe("var(--color-bg-0, #fff)");
      expect(label.attributes("stroke-width")).toBe("3");
      expect(label.attributes("paint-order")).toBe("stroke fill");
    });

    it("honors line and label styling overrides", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [
            {
              x: 2,
              label: "A",
              color: "#f00",
              strokeWidth: 3,
              dashed: false,
              labelOutlineColor: "#000",
              labelOutlineWidth: 5,
              labelStyle: { color: "#00f", fontSize: 14, fontWeight: 400 },
            },
          ],
        },
      });
      const line = wrapper.find('[data-testid="marker-line"]');
      expect(line.attributes("stroke")).toBe("#f00");
      expect(line.attributes("stroke-width")).toBe("3");
      expect(line.attributes("stroke-dasharray")).toBeUndefined();
      const label = wrapper.find('[data-testid="marker-label"]');
      expect(label.attributes("fill")).toBe("#00f");
      expect(label.attributes("font-size")).toBe("14");
      expect(label.attributes("font-weight")).toBe("400");
      expect(label.attributes("stroke")).toBe("#000");
      expect(label.attributes("stroke-width")).toBe("5");
    });

    it("renders a page-colored outline behind the line when outline is true", () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: 5, outline: true }] },
      });
      const outline = wrapper.find('[data-testid="marker-outline"]');
      expect(outline.exists()).toBe(true);
      expect(outline.attributes("stroke")).toBe("var(--color-bg-0, #fff)");
      expect(outline.attributes("stroke-width")).toBe("5.5");
    });

    it("drops a colliding label down to the next row", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [
            { x: 5, label: "One" },
            { x: 5.2, label: "Two" },
          ],
        },
      });
      const labels = wrapper.findAll('[data-testid="marker-label"]');
      expect(labels[0].attributes("y")).toBe("22");
      expect(labels[1].attributes("y")).toBe("37");
    });

    it("honors markerLabelGap for extra clearance above the lines", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markerLabelGap: 20,
          markers: [{ x: 5, label: "Isolation" }],
        },
      });
      // Reserved top room grows to 20 + 12 → padding.top 42; the label
      // baseline sits 20px above the top of the line.
      const line = wrapper.find('[data-testid="marker-line"]');
      expect(line.attributes("y1")).toBe("42");
      const label = wrapper.find('[data-testid="marker-label"]');
      expect(label.attributes("y")).toBe("22");
    });

    it("reserves top room based on the tallest label font", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [{ x: 5, label: "Big", labelStyle: { fontSize: 20 } }],
        },
      });
      // Room = 7 + 20 → padding.top 37; baseline at 37 - 7.
      const line = wrapper.find('[data-testid="marker-line"]');
      expect(line.attributes("y1")).toBe("37");
      const label = wrapper.find('[data-testid="marker-label"]');
      expect(label.attributes("y")).toBe("30");
    });

    it("does not render a hit target when draggable is false", () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: 5, draggable: false }] },
      });
      expect(wrapper.find('[data-testid="marker-hit"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="marker-line"]').exists()).toBe(true);
    });

    it("emits update:markers and markerDrag while dragging, markerDragEnd on release", async () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: 5, label: "Isolation" }] },
      });
      const hit = wrapper.find('[data-testid="marker-hit"]');
      // happy-dom rects are all zeros, so clientX maps through
      // padding.left directly: x = (clientX - 50) / 540 * 10.
      await hit.trigger("pointerdown", { clientX: 320, button: 0 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 428 }));
      await wrapper.vm.$nextTick();

      const updates = wrapper.emitted("update:markers")!;
      expect(updates.length).toBeGreaterThanOrEqual(1);
      const moved = updates[updates.length - 1][0] as { x: number }[];
      expect(moved[0].x).toBeCloseTo(7);
      const drags = wrapper.emitted("markerDrag")!;
      expect(drags[drags.length - 1][0]).toMatchObject({ index: 0 });

      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 428 }));
      const ends = wrapper.emitted("markerDragEnd")!;
      expect(ends.length).toBe(1);
      expect((ends[0][0] as { x: number }).x).toBeCloseTo(7);
    });

    it("keeps the grab offset so the line does not jump to the pointer", async () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: 5 }] },
      });
      const hit = wrapper.find('[data-testid="marker-hit"]');
      // Grab 5px right of the line (within the hit strip)...
      await hit.trigger("pointerdown", { clientX: 325, button: 0 });
      // ...and move 108px right: the marker should move exactly +2 data units.
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 433 }));
      const updates = wrapper.emitted("update:markers")!;
      const moved = updates[updates.length - 1][0] as { x: number }[];
      expect(moved[0].x).toBeCloseTo(7);
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 433 }));
    });

    it("moves the marker by one index step on arrow keys", async () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: 5 }] },
      });
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("keydown", { key: "ArrowRight" });
      let updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(6);
      expect(wrapper.emitted("markerDragEnd")!.length).toBe(1);
      await hit.trigger("keydown", { key: "ArrowLeft" });
      updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(4);
    });

    it("shows the current x above the x axis while dragging", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [
            { x: 5, label: "Peak" },
            {
              x: 2,
              valueFormat: (x) => `day ${x}`,
              valueStyle: { fontSize: 14, color: "#123456", fontWeight: 700 },
              valueOutlineColor: "#000",
              valueOutlineWidth: 1,
              valueBlendMode: "multiply",
            },
          ],
        },
        attachTo: document.body,
      });
      expect(wrapper.find('[data-testid="marker-value"]').exists()).toBe(false);
      const hits = wrapper.findAll('[data-testid="marker-hit"]');
      await hits[0].trigger("pointerdown", { clientX: 320, pointerId: 1 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 374 }));
      await nextTick();
      let value = wrapper.find('[data-testid="marker-value"]');
      // 54px per data unit → x 6, 4px right of the line and 4px above the
      // plot bottom (270), in regular haloed text.
      expect(value.text()).toBe("6");
      expect(value.attributes("x")).toBe("378");
      expect(value.attributes("y")).toBe("266");
      expect(value.attributes("text-anchor")).toBe("start");
      expect(value.attributes("font-size")).toBe("12");
      expect(value.attributes("font-weight")).toBe("400");
      expect(value.attributes("fill")).toBe("currentColor");
      expect(value.attributes("stroke-width")).toBe("3");
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 374 }));
      await nextTick();
      expect(wrapper.find('[data-testid="marker-value"]').exists()).toBe(false);

      // An unlabeled marker shows it too, through valueFormat.
      await hits[1].trigger("pointerdown", { clientX: 158, pointerId: 2 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 212 }));
      await nextTick();
      value = wrapper.find('[data-testid="marker-value"]');
      expect(value.text()).toBe("day 3");
      expect(value.attributes("x")).toBe("216");
      expect(value.attributes("font-size")).toBe("14");
      expect(value.attributes("font-weight")).toBe("700");
      expect(value.attributes("fill")).toBe("#123456");
      expect(value.attributes("stroke")).toBe("#000");
      expect(value.attributes("stroke-width")).toBe("1");
      expect(value.attributes("style")).toContain("mix-blend-mode: multiply");
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 212 }));
      await nextTick();
      wrapper.unmount();
    });

    it("hides the drag value when showValueOnDrag is false", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          markers: [{ x: 5, label: "Peak", showValueOnDrag: false }],
        },
        attachTo: document.body,
      });
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("pointerdown", { clientX: 320, pointerId: 1 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 374 }));
      await nextTick();
      expect(wrapper.find('[data-testid="marker-value"]').exists()).toBe(false);
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 374 }));
      await nextTick();
      wrapper.unmount();
    });

    it("clamps drag and keyboard moves to the data extent", async () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: 10 }] },
      });
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("keydown", { key: "ArrowRight" });
      const updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(10);
    });

    it("positions and emits in display space when xMin offsets the axis", async () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 5, 10],
          xMin: 10,
          width: 600,
          height: 300,
          menu: false,
          markers: [{ x: 11 }],
        },
      });
      // Display 10..12 maps to internal 0..2; x=11 is the middle.
      const line = wrapper.find('[data-testid="marker-line"]');
      expect(line.attributes("x1")).toBe("320");
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("keydown", { key: "ArrowRight" });
      const updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(12);
    });

    it("renders markers on a date axis and emits Date positions", async () => {
      const wrapper = mount(LineChart, {
        props: {
          x: ["2026-01-01", "2026-01-11"],
          y: [0, 10],
          width: 600,
          height: 300,
          menu: false,
          markers: [{ x: "2026-01-06", label: "Peak" }],
        },
      });
      const line = wrapper.find('[data-testid="marker-line"]');
      expect(line.attributes("x1")).toBe("320");
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("keydown", { key: "ArrowRight" });
      const updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: Date;
      }[];
      expect(updated[0].x).toBeInstanceOf(Date);
      // One step is 1/100 of the 10-day range
      expect(updated[0].x.getTime()).toBe(
        Date.parse("2026-01-06T00:00:00Z") + (10 * 86400000) / 100,
      );
    });

    it("formats the drag readout on a date axis like the ticks", async () => {
      const wrapper = mount(LineChart, {
        props: {
          x: ["2026-01-01", "2026-01-11"],
          y: [0, 10],
          width: 600,
          height: 300,
          menu: false,
          markers: [{ x: "2026-01-06", label: "Peak" }],
        },
        attachTo: document.body,
      });
      const tick = wrapper.findAll('[data-testid="x-tick"]')[0].text();
      expect(tick).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("pointerdown", { clientX: 320, pointerId: 1 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 374 }));
      await nextTick();
      // 54px per day → Jan 7, in the same "Mon D" style as the ticks.
      expect(wrapper.find('[data-testid="marker-value"]').text()).toBe("Jan 7");
      expect(hit.attributes("aria-valuetext")).toBe("Jan 7");
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 374 }));
      await nextTick();
      wrapper.unmount();
    });

    it("snaps drags and arrow keys to series x positions", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          x: [0, 3, 4, 10],
          data: [0, 5, 5, 0],
          markers: [{ x: 3, label: "A", snap: true }],
        },
        attachTo: document.body,
      });
      const hit = wrapper.find('[data-testid="marker-hit"]');
      // x 3 is at 50 + 3 * 54 = 212; 70px right (x ≈ 4.3) snaps to 4.
      await hit.trigger("pointerdown", { clientX: 212, pointerId: 1 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 282 }));
      await nextTick();
      expect(wrapper.find('[data-testid="marker-line"]').attributes("x1")).toBe(
        "266",
      );
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 282 }));
      await nextTick();
      let updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(4);
      await wrapper.setProps({ markers: updated });
      // Arrow keys step through the grid: 4 → 10, then back to 4.
      await hit.trigger("keydown", { key: "ArrowRight" });
      updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(10);
      await wrapper.setProps({ markers: updated });
      await hit.trigger("keydown", { key: "ArrowLeft" });
      updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(4);
      wrapper.unmount();
    });

    it("snaps to a numeric step from the axis origin", async () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 5, 10, 5, 0],
          xMin: 10,
          width: 600,
          height: 300,
          menu: false,
          markers: [{ x: 11, snap: 2.5 }],
        },
        attachTo: document.body,
      });
      // Display 10..14 over 540px → 135px per unit; x 11 is at 185.
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("pointerdown", { clientX: 185, pointerId: 1 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 320 }));
      await nextTick();
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 320 }));
      await nextTick();
      let updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      // Display 12 snaps to the 12.5 multiple of 2.5.
      expect(updated[0].x).toBe(12.5);
      await wrapper.setProps({ markers: updated });
      await hit.trigger("keydown", { key: "ArrowLeft" });
      updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: number;
      }[];
      expect(updated[0].x).toBe(10);
      wrapper.unmount();
    });

    it("snaps to whole days on a date axis", async () => {
      const wrapper = mount(LineChart, {
        props: {
          x: ["2026-01-01", "2026-01-11"],
          y: [0, 10],
          width: 600,
          height: 300,
          menu: false,
          markers: [{ x: "2026-01-06", snap: 86400000 }],
        },
        attachTo: document.body,
      });
      const hit = wrapper.find('[data-testid="marker-hit"]');
      await hit.trigger("pointerdown", { clientX: 320, pointerId: 1 });
      // 54px per day; 80px is 1.48 days → snaps to Jan 7.
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 400 }));
      await nextTick();
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 400 }));
      await nextTick();
      const updated = wrapper.emitted("update:markers")!.at(-1)![0] as {
        x: Date;
      }[];
      expect(updated[0].x.toISOString()).toBe("2026-01-07T00:00:00.000Z");
      wrapper.unmount();
    });

    it("skips markers with unparseable x values", () => {
      const wrapper = mount(LineChart, {
        props: { ...baseProps, markers: [{ x: "not-a-date" }, { x: 5 }] },
      });
      expect(wrapper.findAll('[data-testid="marker-line"]').length).toBe(1);
    });
  });

  describe("zoom", () => {
    // 11 points at x = 0..10. happy-dom rects are all zeros, so clientX
    // maps through padding.left directly: x = (clientX - 50) / 540 * 10.
    const zoomProps = {
      data: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      width: 600,
      height: 300,
      menu: false,
      zoom: true,
    };
    const overlay = (w: ReturnType<typeof mount>) =>
      w.find('[data-testid="chart-overlay"]');
    const tickNumbers = (w: ReturnType<typeof mount>, id: string) =>
      w.findAll(`[data-testid="${id}"]`).map((t) => Number(t.text()));

    async function brush(
      w: ReturnType<typeof mount>,
      from: number,
      to: number,
    ) {
      await overlay(w).trigger("pointerdown", { clientX: from, button: 0 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: to }));
      await w.vm.$nextTick();
    }
    async function release(w: ReturnType<typeof mount>, at: number) {
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: at }));
      await w.vm.$nextTick();
    }

    it("renders no overlay or reset button unless zoom is enabled", () => {
      const wrapper = mount(LineChart, {
        props: { ...zoomProps, zoom: false },
      });
      expect(overlay(wrapper).exists()).toBe(false);
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);
    });

    it("shows the selection while dragging, then zooms both axes on release", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);

      // x = 2 → 6
      await brush(wrapper, 158, 374);
      const rect = wrapper.find('[data-testid="zoom-brush"]');
      expect(rect.attributes("x")).toBe("158");
      expect(rect.attributes("width")).toBe("216");

      await release(wrapper, 374);
      expect(wrapper.find('[data-testid="zoom-brush"]').exists()).toBe(false);
      const xs = tickNumbers(wrapper, "x-tick");
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(2);
      expect(Math.max(...xs)).toBeLessThanOrEqual(6);
      // y rescales to the values visible in the window (20..60)
      const ys = tickNumbers(wrapper, "y-tick");
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
      expect(Math.max(...ys)).toBeLessThanOrEqual(60);
      expect(wrapper.find("clipPath").exists()).toBe(true);
    });

    it("resets from the reset button and on double-click", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      const full = tickNumbers(wrapper, "x-tick");

      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      await wrapper.find('[aria-label="Reset zoom"]').trigger("click");
      expect(tickNumbers(wrapper, "x-tick")).toEqual(full);
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);
      expect(wrapper.find("clipPath").exists()).toBe(false);

      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      await overlay(wrapper).trigger("dblclick");
      expect(tickNumbers(wrapper, "x-tick")).toEqual(full);
    });

    it("ignores a press that barely moves", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      await brush(wrapper, 158, 160);
      expect(wrapper.find('[data-testid="zoom-brush"]').exists()).toBe(false);
      await release(wrapper, 160);
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);
    });

    it("cancels an in-progress drag on Escape", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      await brush(wrapper, 158, 374);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await release(wrapper, 374);
      expect(wrapper.find('[data-testid="zoom-brush"]').exists()).toBe(false);
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);
    });

    it.each(["touch", "pen"])(
      "does not start a brush from a %s pointer",
      async (pointerType) => {
        const wrapper = mount(LineChart, { props: zoomProps });
        await overlay(wrapper).trigger("pointerdown", {
          clientX: 158,
          button: 0,
          pointerType,
        });
        window.dispatchEvent(new MouseEvent("pointermove", { clientX: 374 }));
        await release(wrapper, 374);
        expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);
      },
    );

    it("caps how deep repeated zooms can go", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      for (let i = 0; i < 12; i++) {
        await brush(wrapper, 300, 310);
        await release(wrapper, 310);
      }
      // Window bottoms out at 1/10,000 of the 0..10 range.
      const xs = tickNumbers(wrapper, "x-tick");
      expect(xs.length).toBeGreaterThan(0);
      expect(xs.length).toBeLessThan(20);
      expect(new Set(xs).size).toBe(xs.length);
    });

    it("only builds path geometry near the zoom window", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      const pathPoints = () =>
        wrapper
          .find('path[stroke="currentColor"]')
          .attributes("d")!
          .split(/[ML]/).length - 1;
      expect(pathPoints()).toBe(11);
      // x = 2 → 6: points 2..6 plus one neighbor on each side
      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      expect(pathPoints()).toBe(7);
    });

    it("rescales y to the value a step curve holds across the window", async () => {
      // step-after holds 100 from x=0 to x=10; no point falls in 2..6.
      const wrapper = mount(LineChart, {
        props: {
          ...zoomProps,
          data: undefined,
          series: [{ x: [0, 10], data: [100, 0], curve: "step-after" }],
        },
      });
      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      expect(
        Math.max(...tickNumbers(wrapper, "y-tick")),
      ).toBeGreaterThanOrEqual(100);
    });

    it("keeps monotone tangents at the culled edges of the zoom window", async () => {
      // Every point is a local extreme, so every tangent is flat: each
      // control point shares the y of the point it leaves or enters.
      const wrapper = mount(LineChart, {
        props: {
          ...zoomProps,
          data: [0, 10, 0, 10, 0, 10, 0, 10, 0, 10, 0],
          curve: "monotone",
        },
      });
      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      const d = wrapper.find('path[stroke="currentColor"]').attributes("d")!;
      const nums = (t: string) => t.split(",").map(Number);
      let prevY = nums(d.match(/^M([^C]+)/)![1])[1];
      const curves = [...d.matchAll(/C([^C]+)/g)].map((m) => nums(m[1]));
      // x = 2 -> 6 draws points 1..7.
      expect(curves).toHaveLength(6);
      for (const [, y1, , y2, , y] of curves) {
        expect(y1).toBeCloseTo(prevY);
        expect(y2).toBeCloseTo(y);
        prevY = y;
      }
    });

    async function boxBrush(
      w: ReturnType<typeof mount>,
      from: { clientX: number; clientY: number },
      to: { clientX: number; clientY: number },
    ) {
      await overlay(w).trigger("pointerdown", { ...from, button: 0 });
      window.dispatchEvent(new MouseEvent("pointermove", to));
      await w.vm.$nextTick();
      const rect = w.find('[data-testid="zoom-brush"]');
      const drawn = {
        y: Number(rect.attributes("y")),
        height: Number(rect.attributes("height")),
      };
      window.dispatchEvent(new MouseEvent("pointerup", to));
      await w.vm.$nextTick();
      return drawn;
    }

    it("zooms both axes to a box when the drag is tall enough", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      // Plot spans y = 10..270 for values 100..0.
      const drawn = await boxBrush(
        wrapper,
        { clientX: 158, clientY: 62 },
        { clientX: 374, clientY: 166 },
      );
      expect(drawn).toEqual({ y: 62, height: 104 });
      const xs = tickNumbers(wrapper, "x-tick");
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(2);
      expect(Math.max(...xs)).toBeLessThanOrEqual(6);
      // y = 62px → 80, y = 166px → 40
      const ys = tickNumbers(wrapper, "y-tick");
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(40);
      expect(Math.max(...ys)).toBeLessThanOrEqual(80);
      expect(ys).toContain(80);

      await wrapper.find('[aria-label="Reset zoom"]').trigger("click");
      expect(Math.max(...tickNumbers(wrapper, "y-tick"))).toBe(100);
    });

    it("treats a nearly straight drag as an x-only zoom", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      const drawn = await boxBrush(
        wrapper,
        { clientX: 158, clientY: 100 },
        { clientX: 374, clientY: 115 },
      );
      // Full-height band, and y rescales to the window's data (20..60).
      expect(drawn).toEqual({ y: 10, height: 260 });
      const ys = tickNumbers(wrapper, "y-tick");
      expect(Math.min(...ys)).toBe(20);
      expect(Math.max(...ys)).toBe(60);
    });

    it("leaves the marks on the window's extreme points whole", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...zoomProps,
          series: [{ data: zoomProps.data, dots: true, dotRadius: 4 }],
        },
      });
      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      // y rescales to the window's data (20..60), so the dots at x = 2 and
      // x = 6 sit on the plot's bottom and top edges: the clip opens there
      // and stays exact on the x edges, which cut through the line.
      const clip = wrapper.find("clipPath rect");
      expect(clip.attributes("x")).toBe("50");
      expect(clip.attributes("width")).toBe("540");
      expect(Number(clip.attributes("y"))).toBeLessThanOrEqual(10 - 4);
      expect(
        Number(clip.attributes("y")) + Number(clip.attributes("height")),
      ).toBeGreaterThanOrEqual(270 + 4);
      const cys = wrapper
        .findAll("circle")
        .map((c) => Number(c.attributes("cy")));
      expect(cys).toContain(270);
      expect(cys).toContain(10);
    });

    it("clips a box zoom exactly on the edges that cut through data", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      // x = 2..6 (data 20..60), y = 40..80: the bottom edge cuts the line,
      // nothing rises above the top edge.
      await boxBrush(
        wrapper,
        { clientX: 158, clientY: 62 },
        { clientX: 374, clientY: 166 },
      );
      const clip = wrapper.find("clipPath rect");
      expect(Number(clip.attributes("y"))).toBeLessThan(10);
      expect(
        Number(clip.attributes("y")) + Number(clip.attributes("height")),
      ).toBe(270);
    });

    it("opens the clip on an x edge clamped to the data's extent", async () => {
      const wrapper = mount(LineChart, { props: zoomProps });
      // Dragged past the plot's right edge (x = 590): the window ends at
      // the last point, so that edge is open while the left one is exact.
      await brush(wrapper, 158, 700);
      await release(wrapper, 700);
      const clip = wrapper.find("clipPath rect");
      expect(clip.attributes("x")).toBe("50");
      expect(Number(clip.attributes("width"))).toBeGreaterThan(540);
    });

    it('never draws a box with zoom="x"', async () => {
      const wrapper = mount(LineChart, {
        props: { ...zoomProps, zoom: "x" as const },
      });
      const drawn = await boxBrush(
        wrapper,
        { clientX: 158, clientY: 62 },
        { clientX: 374, clientY: 166 },
      );
      expect(drawn).toEqual({ y: 10, height: 260 });
      const ys = tickNumbers(wrapper, "y-tick");
      expect(Math.min(...ys)).toBe(20);
      expect(Math.max(...ys)).toBe(60);
    });

    it("hides markers outside the zoom window", async () => {
      const wrapper = mount(LineChart, {
        props: { ...zoomProps, markers: [{ x: 1 }, { x: 4 }] },
      });
      expect(wrapper.findAll('[data-testid="marker-line"]').length).toBe(2);
      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      expect(wrapper.findAll('[data-testid="marker-line"]').length).toBe(1);
    });

    it("does not toggle a click-triggered tooltip when a brush ends", async () => {
      const wrapper = mount(LineChart, {
        props: { ...zoomProps, tooltipTrigger: "click" },
      });
      await brush(wrapper, 158, 374);
      await release(wrapper, 374);
      await overlay(wrapper).trigger("click", { clientX: 374 });
      expect(wrapper.emitted("hover")).toBeUndefined();
    });
  });

  describe("legend toggle", () => {
    const toggleProps = {
      series: [
        { data: [0, 5, 10], legend: "Low", color: "red" },
        { data: [0, 500, 1000], legend: "High", color: "blue" },
      ],
      width: 600,
      height: 300,
      menu: false,
      tooltipTrigger: "hover" as const,
      legendToggle: true,
    };
    const toggles = (w: ReturnType<typeof mount>) =>
      w.findAll(".chart-legend-toggle");
    const lines = (w: ReturnType<typeof mount>) =>
      w.findAll("path").filter((p) => p.attributes("fill") === "none");
    const yMax = (w: ReturnType<typeof mount>) =>
      Math.max(
        ...w
          .findAll('[data-testid="y-tick"]')
          .map((t) => Number(t.text().replace(/,/g, ""))),
      );

    it("renders no toggle buttons unless legendToggle is set", () => {
      const wrapper = mount(LineChart, {
        props: { ...toggleProps, legendToggle: false },
      });
      expect(toggles(wrapper).length).toBe(0);
    });

    it("renders a pressed button per legend item, outside the svg", () => {
      const wrapper = mount(LineChart, { props: toggleProps });
      const buttons = toggles(wrapper);
      expect(buttons.map((b) => b.attributes("aria-label"))).toEqual([
        "Low",
        "High",
      ]);
      expect(
        buttons.every((b) => b.attributes("aria-pressed") === "true"),
      ).toBe(true);
      expect(wrapper.find("svg .chart-legend-toggle").exists()).toBe(false);
    });

    it("hides the series, rescales y, and emits on click", async () => {
      const wrapper = mount(LineChart, { props: toggleProps });
      expect(lines(wrapper).length).toBe(2);
      expect(yMax(wrapper)).toBe(1000);

      await toggles(wrapper)[1].trigger("click");
      expect(lines(wrapper).length).toBe(1);
      expect(lines(wrapper)[0].attributes("stroke")).toBe("red");
      expect(yMax(wrapper)).toBe(10);
      expect(toggles(wrapper)[1].attributes("aria-pressed")).toBe("false");
      expect(wrapper.emitted("update:hiddenSeries")).toEqual([[["High"]]]);

      await toggles(wrapper)[1].trigger("click");
      expect(lines(wrapper).length).toBe(2);
      expect(wrapper.emitted("update:hiddenSeries")?.[1]).toEqual([[]]);
    });

    it("drops hidden series from the tooltip, keeping seriesIndex", async () => {
      const wrapper = mount(LineChart, {
        props: { ...toggleProps, hiddenSeries: ["Low"] },
        slots: {
          tooltip: `<template #tooltip="{ values }">
            <span class="tip">{{ values.map((v) => v.seriesIndex).join(",") }}</span>
          </template>`,
        },
      });
      await wrapper
        .find('[data-testid="chart-overlay"]')
        .trigger("mousemove", { clientX: 300 });
      expect(wrapper.find(".tip").text()).toBe("1");
    });

    it("follows a controlled hiddenSeries prop", async () => {
      const wrapper = mount(LineChart, {
        props: { ...toggleProps, hiddenSeries: ["High"] },
      });
      expect(lines(wrapper).length).toBe(1);
      // The parent owns the state: a click only emits.
      await toggles(wrapper)[0].trigger("click");
      expect(lines(wrapper).length).toBe(1);
      expect(wrapper.emitted("update:hiddenSeries")).toEqual([
        [["High", "Low"]],
      ]);
      await wrapper.setProps({ hiddenSeries: [] });
      expect(lines(wrapper).length).toBe(2);
    });

    it("toggles areas but not inline area sections", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...toggleProps,
          areas: [{ upper: [1, 6, 11], lower: [0, 4, 9], legend: "Band" }],
          areaSections: [
            { startIndex: 0, endIndex: 1, label: "Phase", legend: "inline" },
          ],
        },
      });
      expect(toggles(wrapper).map((b) => b.attributes("aria-label"))).toEqual([
        "Low",
        "High",
        "Band",
      ]);
    });
  });
});

describe("LineChart intervals", () => {
  function intervals(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('[data-testid="interval"]');
  }

  it("renders a whisker with caps and a value dot for each interval", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20, 30],
        intervals: [
          { x: 1, lower: 5, upper: 15, value: 10 },
          { x: 2, lower: 18, upper: 24 },
        ],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const items = intervals(wrapper);
    expect(items).toHaveLength(2);
    expect(items[0].findAll("line.interval-cap")).toHaveLength(2);
    expect(items[0].find("circle.interval-dot").exists()).toBe(true);
    expect(items[1].find("circle.interval-dot").exists()).toBe(false);
    const line = items[0].find("line.interval-line");
    // Vertical whisker: same x, lower end below upper end on screen.
    expect(line.attributes("x1")).toBe(line.attributes("x2"));
    expect(Number(line.attributes("y1"))).toBeGreaterThan(
      Number(line.attributes("y2")),
    );
  });

  it("extends the y axis to cover interval bounds", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        intervals: [{ x: 1, lower: 5, upper: 80 }],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const labels = wrapper.findAll("text").map((t) => t.text());
    expect(labels).toContain("80");
  });

  it("extends the x axis to cover an interval past the data", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        intervals: [{ x: 6, lower: 5, upper: 8 }],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const labels = wrapper.findAll("text").map((t) => t.text());
    expect(labels).toContain("6");
  });

  it("layers per-interval style over intervalStyle", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        intervals: [
          { x: 1, lower: 5, upper: 15 },
          { x: 2, lower: 5, upper: 15, color: "red", lineWidth: 4 },
        ],
        intervalStyle: { color: "blue", lineWidth: 2, capWidth: 0 },
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const [a, b] = intervals(wrapper);
    expect(a.find("line.interval-line").attributes("stroke")).toBe("blue");
    expect(a.find("line.interval-line").attributes("stroke-width")).toBe("2");
    expect(a.findAll("line.interval-cap")).toHaveLength(0);
    expect(b.find("line.interval-line").attributes("stroke")).toBe("red");
    expect(b.find("line.interval-line").attributes("stroke-width")).toBe("4");
  });

  it("draws an outline pass only when outlineWidth is set", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        intervals: [
          { x: 1, lower: 5, upper: 15 },
          { x: 2, lower: 5, upper: 15, outlineWidth: 3 },
        ],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const [a, b] = intervals(wrapper);
    expect(a.findAll(".interval-outline")).toHaveLength(0);
    expect(b.findAll(".interval-outline")).toHaveLength(3);
    expect(b.find(".interval-outline").attributes("stroke-width")).toBe("4.5");
  });

  it("expands series lower/upper into whiskers in the series color", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [
          {
            data: [1, 2, 3],
            lower: [0, 1, 2],
            upper: [2, 3, 4],
            color: "#123456",
            legend: "A",
          },
        ],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const items = intervals(wrapper);
    expect(items).toHaveLength(3);
    expect(items[0].find("line.interval-line").attributes("stroke")).toBe(
      "#123456",
    );
    // Series whiskers rely on the series' own marks for the point estimate.
    expect(items[0].find("circle.interval-dot").exists()).toBe(false);
  });

  it("hides series whiskers along with a legend-hidden series", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [
          { data: [1, 2], lower: [0, 1], upper: [2, 3], legend: "A" },
          { data: [5, 6], legend: "B" },
        ],
        hiddenSeries: ["A"],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    expect(intervals(wrapper)).toHaveLength(0);
  });

  it("offsets interval x by xMin like the series", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        xMin: 10,
        intervals: [{ x: 11, lower: 5, upper: 15 }],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const line = intervals(wrapper)[0].find("line.interval-line");
    const path = wrapper.find("path[fill='none']");
    // Middle data point lands at the plot's horizontal center.
    const d = path.attributes("d") ?? "";
    const midX = Number(d.split("L")[1].split(",")[0]);
    expect(Number(line.attributes("x1"))).toBeCloseTo(midX, 5);
  });

  it("ties a standalone interval to a series for color and hiding", () => {
    const props = {
      series: [
        { data: [1, 2], color: "#abcdef", legend: "A" },
        { data: [3, 4], legend: "B" },
      ],
      intervals: [{ x: 1, lower: 0, upper: 5, seriesIndex: 0 }],
      width: 400,
      height: 200,
      menu: false,
    };
    const shown = mount(LineChart, { props });
    expect(
      intervals(shown)[0].find("line.interval-line").attributes("stroke"),
    ).toBe("#abcdef");
    const hidden = mount(LineChart, {
      props: { ...props, hiddenSeries: ["A"] },
    });
    expect(intervals(hidden)).toHaveLength(0);
  });

  it("shows a standalone interval between data points in the tooltip", async () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [1, 2, 3],
        intervals: [{ x: 1.3, lower: 10, upper: 20 }],
        width: 400,
        height: 200,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
      slots: {
        tooltip: `<template #tooltip="p">
          <div class="tt">{{ p.index }}|{{ p.intervals.length }}</div>
        </template>`,
      },
    });
    const overlay = wrapper.find('[data-testid="chart-overlay"]');
    await overlay.trigger("mousemove", { clientX: 200 });
    expect(wrapper.find(".tt").text()).toBe("1|1");
    await overlay.trigger("mousemove", { clientX: 380 });
    expect(wrapper.find(".tt").text()).toBe("2|0");
  });

  it("includes interval bounds in the tooltip and CSV", async () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [1, 2], lower: [0, 1], upper: [2, 3] }],
        intervals: [{ x: 1, lower: 10, upper: 20, value: 15 }],
        width: 400,
        height: 200,
        menu: false,
        downloadLink: true,
        tooltipTrigger: "hover" as const,
      },
      slots: {
        tooltip: `<template #tooltip="p">
          <div class="tt">{{ p.values[0].lower }}-{{ p.values[0].upper }}|{{ p.intervals.map(i => i.lower + '-' + i.upper).join() }}</div>
        </template>`,
      },
    });
    await wrapper
      .find('[data-testid="chart-overlay"]')
      .trigger("mousemove", { clientX: 300 });
    expect(wrapper.find(".tt").text()).toBe("1-3|10-20");
    const link = wrapper.find("a.line-chart-download-link");
    expect(decodeURIComponent(link.attributes("href") ?? "")).toContain(
      "index,value,value_lower,value_upper\n0,1,0,2\n1,2,1,3",
    );
  });

  describe("grid lines", () => {
    const grid = (wrapper: ReturnType<typeof mount>, axis: "x" | "y") =>
      wrapper.findAll(`[data-axis="${axis}"] [data-testid="grid-line"]`);

    it("draws no grid by default", () => {
      const wrapper = mount(LineChart, {
        props: { data: [0, 10, 20], width: 400, height: 200, menu: false },
      });
      expect(wrapper.findAll('[data-testid="grid-line"]').length).toBe(0);
    });

    it("draws default-styled lines for `true`", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          width: 400,
          height: 200,
          menu: false,
          yGrid: true,
        },
      });
      const lines = grid(wrapper, "y");
      expect(lines.length).toBeGreaterThan(0);
      expect(grid(wrapper, "x").length).toBe(0);
      const a = lines[0].attributes();
      expect(a.stroke).toBe("currentColor");
      expect(a["stroke-opacity"]).toBe("0.1");
      expect(a["stroke-width"]).toBe("1");
      expect(a["stroke-dasharray"]).toBeUndefined();
      expect(a["stroke-linecap"]).toBe("butt");
      expect(a.x1).not.toBe(a.x2);
      expect(a.y1).toBe(a.y2);
    });

    it("styles each axis from its own GridStyle over the chart gridStyle", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          width: 400,
          height: 200,
          menu: false,
          gridStyle: { color: "#999", opacity: 0.4 },
          xGrid: { lineStyle: "dotted", lineWidth: 2 },
          yGrid: { lineStyle: "dashed", color: "red" },
        },
      });
      const x = grid(wrapper, "x")[0].attributes();
      expect(x.stroke).toBe("#999");
      expect(x["stroke-opacity"]).toBe("0.4");
      expect(x["stroke-width"]).toBe("2");
      expect(x["stroke-dasharray"]).toBe("0 6");
      expect(x["stroke-linecap"]).toBe("round");
      expect(x.x1).toBe(x.x2);
      const y = grid(wrapper, "y")[0].attributes();
      expect(y.stroke).toBe("red");
      expect(y["stroke-opacity"]).toBe("0.4");
      expect(y["stroke-dasharray"]).toBe("4 4");
    });

    it("passes a raw lineDash through", () => {
      const wrapper = mount(LineChart, {
        props: {
          data: [0, 10, 20],
          width: 400,
          height: 200,
          menu: false,
          yGrid: { lineDash: [2, 6] },
        },
      });
      expect(grid(wrapper, "y")[0].attributes("stroke-dasharray")).toBe("2 6");
    });
  });
});

describe("LineChart curve", () => {
  const areaPath = (w: ReturnType<typeof mount>) =>
    w.find('path[stroke="none"]').attributes("d")!;
  const commands = (d: string) => d.replace(/[^MLCZ]/g, "");

  it("applies the chart-level curve to series and areas, and a series curve wins", () => {
    const w = mount(LineChart, {
      props: {
        curve: "monotone",
        series: [
          { data: [0, 10, 5] },
          { data: [1, 2, 3], curve: "step-after" },
        ],
        areas: [{ upper: [2, 12, 7], lower: [0, 8, 3] }],
        width: 300,
        height: 100,
        menu: false,
      },
    });
    const lines = w
      .findAll('path[fill="none"]:not([data-testid])')
      .map((p) => commands(p.attributes("d")!));
    expect(lines).toEqual(["MCC", "MLLLL"]);
    expect(commands(areaPath(w))).toBe("MCCLCCZ");
  });

  it("curves an area's own edges", () => {
    const w = mount(LineChart, {
      props: {
        areas: [{ upper: [2, 12], lower: [0, 8], curve: "step" }],
        width: 300,
        height: 100,
        menu: false,
      },
    });
    expect(commands(areaPath(w))).toBe("MLLLLLLLZ");
  });

  it("draws a section's line on the series' monotone curve", () => {
    const w = mount(LineChart, {
      props: {
        series: [{ data: [0, 4, 1, 6, 3, 8, 2, 5], curve: "monotone" }],
        areaSections: [{ seriesIndex: 0, startIndex: 2, endIndex: 5 }],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const paths = w.findAll('path[fill="none"]').map((p) => p.attributes("d")!);
    const line = paths.find((d) => (d.match(/C/g) ?? []).length === 7)!;
    const section = paths.find((d) => (d.match(/C/g) ?? []).length === 3)!;
    const segs = line.split("C").slice(1);
    expect(section.split("C").slice(1)).toEqual(segs.slice(2, 5));
  });

  it("breaks a section at missing values instead of drawing NaN", () => {
    const w = mount(LineChart, {
      props: {
        series: [{ data: [1, NaN, 3, 4, NaN, 6, 7] }],
        areaSections: [{ seriesIndex: 0, startIndex: 1, endIndex: 6 }],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const fill = w.find('[data-testid="section-fill"]').attributes("d")!;
    expect(fill).not.toContain("NaN");
    expect(fill.match(/Z/g)).toHaveLength(2);
  });
});
