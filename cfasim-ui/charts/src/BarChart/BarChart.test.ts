import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import BarChart from "./BarChart.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import * as download from "../ChartMenu/download.js";

function bars(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="bar"]');
}

describe("BarChart", () => {
  it("renders one bar per category for a single series", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [10, 20, 30, 40],
        categories: ["A", "B", "C", "D"],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    expect(bars(wrapper).length).toBe(4);
  });

  it("accepts a typed array as data", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: new Float64Array([1, 2, 3]),
        width: 300,
        height: 150,
        menu: false,
      },
    });
    expect(bars(wrapper).length).toBe(3);
  });

  it("accepts y as an alias for data", () => {
    const a = mount(BarChart, {
      props: { y: [1, 2, 3], width: 300, height: 150, menu: false },
    });
    const b = mount(BarChart, {
      props: { data: [1, 2, 3], width: 300, height: 150, menu: false },
    });
    expect(bars(a).length).toBe(bars(b).length);
  });

  it("renders k * categoryCount bars in grouped mode", () => {
    const wrapper = mount(BarChart, {
      props: {
        series: [{ data: [1, 2, 3] }, { data: [4, 5, 6] }],
        categories: ["A", "B", "C"],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    expect(bars(wrapper).length).toBe(6);
  });

  it("stacks bars when layout is stacked", () => {
    const wrapper = mount(BarChart, {
      props: {
        series: [{ data: [10, 20] }, { data: [5, 15] }],
        categories: ["A", "B"],
        layout: "stacked" as const,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const found = bars(wrapper);
    expect(found.length).toBe(4);
    // In stacked mode all bars in a category share the same x and width
    const catA = found.filter((b) => b.attributes("data-category") === "0");
    expect(catA[0].attributes("x")).toBe(catA[1].attributes("x"));
    expect(catA[0].attributes("width")).toBe(catA[1].attributes("width"));
  });

  it("overlays bars at full group width when layout is overlay", () => {
    const wrapper = mount(BarChart, {
      props: {
        series: [{ data: [10, 20] }, { data: [5, 15] }],
        categories: ["A", "B"],
        layout: "overlay" as const,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const found = bars(wrapper);
    expect(found.length).toBe(4);
    // In overlay, both series in a category share the same x and width
    // (full group width), like stacked — but each bar starts from the
    // shared baseline rather than stacking.
    const catA = found.filter((b) => b.attributes("data-category") === "0");
    expect(catA[0].attributes("x")).toBe(catA[1].attributes("x"));
    expect(catA[0].attributes("width")).toBe(catA[1].attributes("width"));
    // Both bars in category A rest on the same baseline (same y+height).
    const baselineA0 =
      Number(catA[0].attributes("y")) + Number(catA[0].attributes("height"));
    const baselineA1 =
      Number(catA[1].attributes("y")) + Number(catA[1].attributes("height"));
    expect(baselineA0).toBeCloseTo(baselineA1, 1);
    // Taller series (data 10 vs 5 in category A) has greater height.
    expect(Number(catA[0].attributes("height"))).toBeGreaterThan(
      Number(catA[1].attributes("height")),
    );
  });

  it("scales overlay value axis to per-series max, not the sum", () => {
    const overlay = mount(BarChart, {
      props: {
        series: [{ data: [10] }, { data: [20] }],
        categories: ["A"],
        layout: "overlay" as const,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const stacked = mount(BarChart, {
      props: {
        series: [{ data: [10] }, { data: [20] }],
        categories: ["A"],
        layout: "stacked" as const,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    // Overlay's tallest bar (value 20) fills the same axis as a 20-max,
    // whereas stacked treats the cumulative 30 as max — so the 20-bar
    // is taller in overlay than in stacked.
    const overlayTop = Math.max(
      ...bars(overlay).map((b) => Number(b.attributes("height"))),
    );
    const stackedTop = Math.max(
      ...bars(stacked).map((b) => Number(b.attributes("height"))),
    );
    expect(overlayTop).toBeGreaterThan(stackedTop);
  });

  it("renders horizontal bars when orientation is horizontal", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [10, 20, 30],
        categories: ["A", "B", "C"],
        orientation: "horizontal" as const,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const found = bars(wrapper);
    expect(found.length).toBe(3);
    // In horizontal mode bars share x (start at baseline) and differ in y.
    const ys = found.map((b) => Number(b.attributes("y")));
    expect(new Set(ys).size).toBe(3);
  });

  it("uses 0 as the baseline by default for grouped layout", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [10, 20],
        categories: ["A", "B"],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const found = bars(wrapper);
    // The taller bar should have a larger height than the shorter one.
    const heights = found.map((b) => Number(b.attributes("height")));
    expect(heights[1]).toBeGreaterThan(heights[0]);
  });

  it("places value-axis ticks at numeric intervals", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [0, 25, 50, 75, 100],
        valueTicks: 25,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const ticks = wrapper
      .findAll('[data-testid="value-tick"]')
      .map((t) => t.text());
    expect(ticks).toEqual(
      expect.arrayContaining(["0", "25", "50", "75", "100"]),
    );
  });

  it("formats value ticks with valueTickFormat", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [0, 50, 100],
        valueTicks: [0, 50, 100],
        valueTickFormat: (v: number) => `${v}%`,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const ticks = wrapper
      .findAll('[data-testid="value-tick"]')
      .map((t) => t.text());
    expect(ticks).toEqual(expect.arrayContaining(["0%", "50%", "100%"]));
  });

  it("renders category labels", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [1, 2, 3],
        categories: ["red", "green", "blue"],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const labels = wrapper
      .findAll('[data-testid="category-tick"]')
      .map((t) => t.text());
    expect(labels).toEqual(["red", "green", "blue"]);
  });

  it("falls back to indices when no categories prop is given", () => {
    const wrapper = mount(BarChart, {
      props: { data: [10, 20], width: 400, height: 200, menu: false },
    });
    const labels = wrapper
      .findAll('[data-testid="category-tick"]')
      .map((t) => t.text());
    expect(labels).toEqual(["0", "1"]);
  });

  it("applies categoryFormat", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [1, 2],
        categories: ["a", "b"],
        categoryFormat: (s: string) => s.toUpperCase(),
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const labels = wrapper
      .findAll('[data-testid="category-tick"]')
      .map((t) => t.text());
    expect(labels).toEqual(["A", "B"]);
  });

  it("renders tooltip overlay when tooltipTrigger is set", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [1, 2, 3],
        categories: ["a", "b", "c"],
        width: 400,
        height: 200,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
    });
    const rects = wrapper.findAll("rect");
    const overlay = rects.find((r) => r.attributes("fill") === "transparent");
    expect(overlay).toBeTruthy();
  });

  it("emits hover with category index on mousemove", async () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [1, 2, 3, 4],
        categories: ["a", "b", "c", "d"],
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
    await overlay.trigger("mousemove", { clientX: 200, clientY: 100 });
    const events = wrapper.emitted("hover");
    expect(events).toBeTruthy();
    expect(events![0][0]).toHaveProperty("index");
    wrapper.unmount();
  });

  it("emits hover null on mouseleave", async () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [1, 2, 3],
        categories: ["a", "b", "c"],
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
    await overlay.trigger("mousemove", { clientX: 200, clientY: 100 });
    await overlay.trigger("mouseleave");
    const events = wrapper.emitted("hover")!;
    expect(events[events.length - 1][0]).toBeNull();
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

    it("auto-generates CSV from categories + series", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["A", "B", "C"],
          width: 400,
          height: 200,
        },
      });
      getMenuItem(wrapper, "Download CSV").action();
      expect(spy).toHaveBeenCalledOnce();
      const [csv, fname] = spy.mock.calls[0];
      expect(csv).toBe("category,value\nA,10\nB,20\nC,30");
      expect(fname).toBe("chart");
    });

    it("renders a download link when downloadLink=true", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          downloadLink: true,
        },
      });
      const link = wrapper.find("a.bar-chart-download-link");
      expect(link.exists()).toBe(true);
      expect(link.text()).toBe("Download data (CSV)");
      expect(link.attributes("href")).toContain(
        encodeURIComponent("category,value\nA,1\nB,2"),
      );
    });

    it("hides Download CSV menu item when downloadLink is set", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          downloadLink: true,
        },
      });
      const items = wrapper.findComponent(ChartMenu).props("items");
      expect(items.find((i) => i.label === "Download CSV")).toBeUndefined();
      expect(items.find((i) => i.label === "Save as SVG")).toBeTruthy();
    });

    it("renders a download button with default text when downloadButton=true", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          downloadButton: true,
        },
      });
      const button = wrapper.find("button.bar-chart-download-button");
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe("Download data (CSV)");
    });

    it("renders a download button with custom text when downloadButton is a string", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          downloadButton: "Get the data",
        },
      });
      const button = wrapper.find("button.bar-chart-download-button");
      expect(button.text()).toBe("Get the data");
    });

    it("hides Download CSV menu item and link when downloadButton is set", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          downloadButton: true,
          downloadLink: true,
        },
      });
      const items = wrapper.findComponent(ChartMenu).props("items");
      expect(items.find((i) => i.label === "Download CSV")).toBeUndefined();
      expect(wrapper.find("a.bar-chart-download-link").exists()).toBe(false);
    });

    it("downloads CSV when the download button is clicked", () => {
      const spy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          downloadButton: true,
          filename: "my-data",
        },
      });
      wrapper.find("button.bar-chart-download-button").trigger("click");
      expect(spy).toHaveBeenCalledWith(expect.any(String), "my-data");
    });

    it("uses filename prop for SVG downloads", () => {
      const spy = vi.spyOn(download, "saveSvg").mockImplementation(() => {});
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          filename: "my-chart",
        },
      });
      getMenuItem(wrapper, "Save as SVG").action();
      expect(spy).toHaveBeenCalledWith(expect.anything(), "my-chart");
    });
  });

  it("uses series legend label in multi-series CSV", () => {
    const wrapper = mount(BarChart, {
      props: {
        series: [
          { data: [1, 2], legend: "low" },
          { data: [3, 4], legend: "high" },
        ],
        categories: ["A", "B"],
        width: 400,
        height: 200,
        downloadLink: true,
      },
    });
    const link = wrapper.find("a.bar-chart-download-link");
    expect(decodeURIComponent(link.attributes("href")!)).toContain(
      "category,low,high\nA,1,3\nB,2,4",
    );
  });

  it("rests grouped bars at zero baseline when data includes negatives", () => {
    const wrapper = mount(BarChart, {
      props: {
        // Symmetric data: a positive and negative of equal magnitude
        // should render as equal-height bars meeting at the zero line
        // in the middle of the chart.
        data: [10, -10],
        categories: ["pos", "neg"],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const found = bars(wrapper);
    expect(found.length).toBe(2);
    const posH = Number(found[0].attributes("height"));
    const negH = Number(found[1].attributes("height"));
    expect(posH).toBeGreaterThan(0);
    expect(negH).toBeGreaterThan(0);
    // For ±N data both bars span half the value axis, so heights match.
    expect(posH).toBeCloseTo(negH, 0);
    // Bar edges meet on the zero line: pos bottom == neg top.
    const posBottom =
      Number(found[0].attributes("y")) + Number(found[0].attributes("height"));
    const negTop = Number(found[1].attributes("y"));
    expect(posBottom).toBeCloseTo(negTop, 1);
  });

  it("places baseline at valueMin when all data is above valueMin", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [60, 90],
        categories: ["A", "B"],
        valueMin: 50,
        width: 400,
        height: 200,
        menu: false,
      },
    });
    const found = bars(wrapper);
    // Bar heights should reflect 10 and 40 (above the 50 baseline), so the
    // ratio of heights is 1:4, not 60:90.
    const heights = found.map((b) => Number(b.attributes("height")));
    expect(heights[1] / heights[0]).toBeCloseTo(4, 1);
  });

  it("skips non-finite values without crashing", () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [10, NaN, 30],
        categories: ["A", "B", "C"],
        width: 400,
        height: 200,
        menu: false,
      },
    });
    // Two real bars (NaN is skipped)
    expect(bars(wrapper).length).toBe(2);
  });

  describe("stacked layout edge cases", () => {
    it("stacks positives and negatives separately, meeting at zero", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [3] }, { data: [-2] }],
          categories: ["A"],
          layout: "stacked" as const,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const found = bars(wrapper);
      expect(found.length).toBe(2);
      // Positive bar's bottom edge and negative bar's top edge should meet
      // on the zero line.
      const pos = found[0];
      const neg = found[1];
      const posBottom =
        Number(pos.attributes("y")) + Number(pos.attributes("height"));
      const negTop = Number(neg.attributes("y"));
      expect(posBottom).toBeCloseTo(negTop, 1);
    });

    it("stacks all-negative values from zero downward", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [-2] }, { data: [-3] }],
          categories: ["A"],
          layout: "stacked" as const,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const found = bars(wrapper);
      expect(found.length).toBe(2);
      // The second bar (data -3) stacks below the first (data -2), so its
      // top edge equals the first bar's bottom edge.
      const first = found[0];
      const second = found[1];
      const firstBottom =
        Number(first.attributes("y")) + Number(first.attributes("height"));
      const secondTop = Number(second.attributes("y"));
      expect(firstBottom).toBeCloseTo(secondTop, 1);
    });
  });

  describe("interactions", () => {
    it("emits hover from clientY in horizontal orientation", async () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2, 3, 4],
          categories: ["A", "B", "C", "D"],
          orientation: "horizontal" as const,
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
      // Move within the first category's vertical slot.
      await overlay.trigger("mousemove", { clientX: 200, clientY: 30 });
      const events = wrapper.emitted("hover");
      expect(events).toBeTruthy();
      expect(events![0][0]).toHaveProperty("index");
      wrapper.unmount();
    });

    it("toggles hover on click when tooltipTrigger is click", async () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2, 3, 4],
          categories: ["A", "B", "C", "D"],
          width: 400,
          height: 200,
          menu: false,
          tooltipTrigger: "click" as const,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("click", { clientX: 100, clientY: 100 });
      const events = wrapper.emitted("hover")!;
      expect(events[events.length - 1][0]).not.toBeNull();
      // Same-bar click toggles off
      await overlay.trigger("click", { clientX: 100, clientY: 100 });
      expect(wrapper.emitted("hover")!.at(-1)![0]).toBeNull();
      wrapper.unmount();
    });

    it("does not emit hover on mouseleave in click mode", async () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2, 3],
          categories: ["A", "B", "C"],
          width: 400,
          height: 200,
          menu: false,
          tooltipTrigger: "click" as const,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("click", { clientX: 100, clientY: 100 });
      const before = wrapper.emitted("hover")!.length;
      await overlay.trigger("mouseleave");
      // mouseleave in click mode is a no-op for emit
      expect(wrapper.emitted("hover")!.length).toBe(before);
      wrapper.unmount();
    });

    it("omits a series from the tooltip when showInTooltip is false", async () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [
            { data: [10, 20], color: "#0057b7" },
            { data: [5, 7], color: "#f4a261", showInTooltip: false },
          ],
          categories: ["A", "B"],
          tooltipTrigger: "hover" as const,
          width: 400,
          height: 200,
          menu: false,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 100, clientY: 100 });
      const rows = wrapper.findAll(".bar-chart-tooltip-row");
      expect(rows.length).toBe(1);
      wrapper.unmount();
    });

    it("uses tooltipValueFormat for tooltip values", async () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1000, 2000],
          categories: ["A", "B"],
          tooltipTrigger: "hover" as const,
          tooltipValueFormat: (v: number) => `$${v.toLocaleString()}`,
          width: 400,
          height: 200,
          menu: false,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 100, clientY: 100 });
      const row = wrapper.find(".bar-chart-tooltip-row");
      expect(row.exists()).toBe(true);
      expect(row.text()).toMatch(/^\$[\d,]+$/);
      wrapper.unmount();
    });

    it("falls back to valueTickFormat for tooltip values", async () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20],
          categories: ["A", "B"],
          tooltipTrigger: "hover" as const,
          valueTickFormat: (v: number) => `${v}%`,
          width: 400,
          height: 200,
          menu: false,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 100, clientY: 100 });
      const row = wrapper.find(".bar-chart-tooltip-row");
      expect(row.text()).toMatch(/\d+%$/);
      wrapper.unmount();
    });

    it("accepts a typed array for tooltipData", async () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["A", "B", "C"],
          tooltipData: new Float64Array([1.5, 2.5, 3.5]),
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
      await overlay.trigger("mousemove", { clientX: 100, clientY: 100 });
      expect(wrapper.find('[data-testid="slot-data"]').text()).toBe("1.5");
      wrapper.unmount();
    });

    it("provides category, values, and data to the tooltip slot", async () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [10, 20] }, { data: [5, 15] }],
          categories: ["A", "B"],
          tooltipData: [{ note: "first" }, { note: "second" }],
          tooltipTrigger: "hover" as const,
          width: 400,
          height: 200,
          menu: false,
        },
        slots: {
          tooltip: `
            <template #default="props">
              <div data-testid="slot-cat">{{ props.category }}</div>
              <div data-testid="slot-count">{{ props.values.length }}</div>
              <div data-testid="slot-data">{{ props.data?.note }}</div>
            </template>
          `,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 320, clientY: 100 });
      // Category B is at index 1; values has 2 entries; data.note = "second".
      expect(wrapper.find('[data-testid="slot-cat"]').text()).toBe("B");
      expect(wrapper.find('[data-testid="slot-count"]').text()).toBe("2");
      expect(wrapper.find('[data-testid="slot-data"]').text()).toBe("second");
      wrapper.unmount();
    });
  });

  describe("rendering options", () => {
    it("renders the title text", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          title: "Weekly cases",
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text").map((t) => t.text());
      expect(texts).toContain("Weekly cases");
    });

    it("renders xLabel and yLabel", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          xLabel: "Day",
          yLabel: "Cases",
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text").map((t) => t.text());
      expect(texts).toContain("Day");
      expect(texts).toContain("Cases");
    });

    it("renders inline legend entries for series with a legend label", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [
            { data: [1, 2], legend: "Pediatric", color: "#0057b7" },
            { data: [3, 4], legend: "Adult", color: "#f4a261" },
          ],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text").map((t) => t.text());
      expect(texts).toContain("Pediatric");
      expect(texts).toContain("Adult");
    });

    it("wraps inline legend items to multiple rows when they overflow width", () => {
      const series = Array.from({ length: 10 }, (_, i) => ({
        data: [i + 1, i + 2],
        legend: `Series ${i + 1} with longer label`,
      }));
      const wrapper = mount(BarChart, {
        props: {
          series,
          categories: ["A", "B"],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      // Each legend label is rendered as one <text>. Collect their y
      // coordinates — multi-row wrapping means more than one distinct y.
      const labelYs = new Set(
        wrapper
          .findAll("text")
          .filter((t) => /^Series /.test(t.text()))
          .map((t) => t.attributes("y")),
      );
      expect(labelYs.size).toBeGreaterThan(1);
    });

    it("hides a series legend entry when showInLegend is false", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [
            { data: [1, 2], legend: "Pediatric" },
            { data: [3, 4], legend: "Adult", showInLegend: false },
          ],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const texts = wrapper.findAll("text").map((t) => t.text());
      expect(texts).toContain("Pediatric");
      expect(texts).not.toContain("Adult");
    });

    it("renders value-axis grid lines when valueGrid is true (default)", () => {
      const wrapper = mount(BarChart, {
        props: { data: [0, 25, 50], width: 400, height: 200, menu: false },
      });
      const gridLines = wrapper
        .findAll("line")
        .filter((l) => l.attributes("stroke-opacity") === "0.1");
      expect(gridLines.length).toBeGreaterThan(0);
    });

    it("omits grid lines when valueGrid is false", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [0, 25, 50],
          valueGrid: false,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const gridLines = wrapper
        .findAll("line")
        .filter((l) => l.attributes("stroke-opacity") === "0.1");
      expect(gridLines.length).toBe(0);
    });

    it("applies a per-series color", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [10, 20], color: "#ff0000" }],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const found = bars(wrapper);
      expect(found[0].attributes("fill")).toBe("#ff0000");
      expect(found[1].attributes("fill")).toBe("#ff0000");
    });

    it("applies blendMode as mix-blend-mode style on each bar", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [
            { data: [10, 20], blendMode: "multiply" as const },
            { data: [5, 15] },
          ],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const found = bars(wrapper);
      const blended = found.filter((b) => b.attributes("data-series") === "0");
      const plain = found.filter((b) => b.attributes("data-series") === "1");
      for (const b of blended) {
        expect(b.attributes("style")).toContain("mix-blend-mode: multiply");
      }
      for (const b of plain) {
        expect(b.attributes("style") ?? "").not.toContain("mix-blend-mode");
      }
    });

    it("applies a per-series opacity", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [10, 20], opacity: 0.4 }],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const found = bars(wrapper);
      expect(found[0].attributes("fill-opacity")).toBe("0.4");
    });

    it("assigns distinct default colors to series without an explicit color", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [1] }, { data: [2] }, { data: [3] }],
          categories: ["A"],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const fills = bars(wrapper).map((b) => b.attributes("fill"));
      expect(new Set(fills).size).toBe(3);
    });

    it("hides the chart menu when menu is false", () => {
      const wrapper = mount(BarChart, {
        props: { data: [1, 2], categories: ["A", "B"], menu: false },
      });
      expect(wrapper.findComponent(ChartMenu).exists()).toBe(false);
    });

    it("uses a custom CSV string via the csv prop", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          csv: "custom,csv\n1,2",
          width: 400,
          height: 200,
          downloadLink: true,
        },
      });
      const href = wrapper
        .find("a.bar-chart-download-link")
        .attributes("href")!;
      expect(decodeURIComponent(href)).toContain("custom,csv\n1,2");
    });

    it("uses a custom CSV function via the csv prop", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          csv: () => "fn,csv\nA,B",
          width: 400,
          height: 200,
          downloadLink: true,
        },
      });
      const href = wrapper
        .find("a.bar-chart-download-link")
        .attributes("href")!;
      expect(decodeURIComponent(href)).toContain("fn,csv\nA,B");
    });

    it("widens slot gaps when barPadding is increased", () => {
      const tight = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["A", "B", "C"],
          barPadding: 0,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const loose = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["A", "B", "C"],
          barPadding: 0.5,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const tightW = Number(bars(tight)[0].attributes("width"));
      const looseW = Number(bars(loose)[0].attributes("width"));
      expect(tightW).toBeGreaterThan(looseW);
    });

    it("uses groupGap to space bars within a category in grouped layout", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [10] }, { data: [20] }],
          categories: ["A"],
          groupGap: 10,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const found = bars(wrapper);
      const x0 = Number(found[0].attributes("x"));
      const w0 = Number(found[0].attributes("width"));
      const x1 = Number(found[1].attributes("x"));
      // Gap between bar 0's right edge and bar 1's left edge equals groupGap.
      expect(x1 - (x0 + w0)).toBeCloseTo(10, 1);
    });
  });

  describe("annotations", () => {
    it("renders an annotation at the category center for vertical bars", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["A", "B", "C"],
          annotations: [
            { x: 1, y: 20, offset: { x: 0, y: -10 }, text: "B is up" },
          ],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const text = wrapper.find("g.chart-annotations text");
      expect(text.exists()).toBe(true);
      expect(text.text()).toContain("B is up");
      const x = Number(text.attributes("x"));
      const expectedCenter =
        Number(bars(wrapper)[1].attributes("x")) +
        Number(bars(wrapper)[1].attributes("width")) / 2;
      // Annotation centers on category index 1 (middle bar's center).
      expect(x).toBeCloseTo(expectedCenter, 0);
    });

    it("renders an annotation on horizontal bars with axes swapped", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["A", "B", "C"],
          orientation: "horizontal" as const,
          annotations: [{ x: 0, y: 10, offset: { x: 20, y: 0 }, text: "A" }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const group = wrapper.find("g.chart-annotations");
      expect(group.exists()).toBe(true);
      // On horizontal bars, category axis runs vertically — the
      // annotation's offsetX still maps to text-anchor "start".
      expect(group.find("text").attributes("text-anchor")).toBe("start");
    });

    it("does not render annotations group when none are provided", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      expect(wrapper.find("g.chart-annotations").exists()).toBe(false);
    });
  });

  describe("valueScaleType: log", () => {
    it("renders powers-of-10 ticks by default", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 10, 100, 1000],
          categories: ["a", "b", "c", "d"],
          valueScaleType: "log",
          width: 400,
          height: 240,
          menu: false,
        },
      });
      const tickLabels = wrapper
        .findAll('[data-testid="value-tick"]')
        .map((t) => t.text());
      expect(tickLabels).toEqual(["1", "10", "100", "1,000"]);
    });

    it("places bars between the axis floor and the value's log position", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 10, 100],
          categories: ["a", "b", "c"],
          valueScaleType: "log",
          width: 400,
          height: 240,
          menu: false,
        },
      });
      const bars = wrapper.findAll('[data-testid="bar"]');
      // Bar heights should grow geometrically: bar2 ≈ 0.5 of inner, bar3 ≈ 1.0.
      const heights = bars.map((b) => Number(b.attributes("height")));
      expect(heights[0]).toBe(0); // value === min → zero height
      expect(heights[1]).toBeGreaterThan(0);
      expect(heights[2]).toBeGreaterThan(heights[1]);
      // The 10-bar should be roughly half the height of the 100-bar.
      expect(heights[1] / heights[2]).toBeCloseTo(0.5, 1);
    });

    it("ignores valueMin <= 0 in log mode", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 10, 100],
          categories: ["a", "b", "c"],
          valueScaleType: "log",
          valueMin: 0,
          width: 400,
          height: 240,
          menu: false,
        },
      });
      const bars = wrapper.findAll('[data-testid="bar"]');
      // Geometry still produces finite, non-NaN positions.
      for (const b of bars) {
        const y = Number(b.attributes("y"));
        const h = Number(b.attributes("height"));
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("date categories", () => {
    it("auto-detects date categories and emits month-anchored labels", () => {
      const cats = [
        "2026-01-01",
        "2026-01-08",
        "2026-01-15",
        "2026-01-22",
        "2026-01-29",
        "2026-02-05",
        "2026-02-12",
        "2026-02-19",
        "2026-02-26",
        "2026-03-05",
        "2026-03-12",
        "2026-03-19",
      ];
      const wrapper = mount(BarChart, {
        props: {
          data: cats.map((_, i) => i),
          categories: cats,
          width: 480,
          height: 220,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="category-tick"]')
        .map((t) => t.text());
      // Default labels for week/month-scale ticks include month names.
      expect(labels.join(" ")).toMatch(/Jan|Feb|Mar/);
      // Tick thinning: fewer labels than there are categories.
      expect(labels.length).toBeLessThan(cats.length);
    });

    it("non-date short labels emit all when they fit", () => {
      const cats = ["a", "b", "c", "d", "e"];
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2, 3, 4, 5],
          categories: cats,
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="category-tick"]')
        .map((t) => t.text());
      expect(labels).toEqual(cats);
    });

    it("thins crowded non-date categorical labels", () => {
      const cats = Array.from({ length: 14 }, (_, i) =>
        (2 + i * 0.22).toFixed(2),
      );
      const wrapper = mount(BarChart, {
        props: {
          data: cats.map((_, i) => i),
          categories: cats,
          width: 320,
          height: 200,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="category-tick"]')
        .map((t) => t.text());
      expect(labels.length).toBeLessThan(cats.length);
      // Kept labels must be a strided subset of the inputs, never reformatted.
      for (const l of labels) {
        expect(cats).toContain(l);
      }
    });

    it("dateFormat overrides the default unit-aware formatter", () => {
      const cats = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"];
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2, 3, 4],
          categories: cats,
          dateFormat: "iso",
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="category-tick"]')
        .map((t) => t.text());
      for (const l of labels) {
        expect(l).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("tooltip label uses dateFormat for date categories", async () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30, 40],
          categories: ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"],
          dateFormat: "month-year",
          tooltipTrigger: "hover" as const,
          width: 480,
          height: 220,
          menu: false,
        },
        attachTo: document.body,
      });
      const overlay = wrapper
        .findAll("rect")
        .find((r) => r.attributes("fill") === "transparent")!;
      await overlay.trigger("mousemove", { clientX: 60, clientY: 100 });
      const tip = wrapper.find(".bar-chart-tooltip-label");
      expect(tip.exists()).toBe(true);
      // Should render via "month-year" preset, not the raw ISO string.
      expect(tip.text()).not.toBe("2026-01-01");
      expect(tip.text()).toContain("2026");
      expect(tip.text()).toMatch(/Jan|Feb|Mar|Apr/);
      wrapper.unmount();
    });

    it("accepts Date instances in the categories array", () => {
      const cats = [
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 1, 1)),
        new Date(Date.UTC(2026, 2, 1)),
        new Date(Date.UTC(2026, 3, 1)),
      ];
      const wrapper = mount(BarChart, {
        props: {
          data: [1, 2, 3, 4],
          categories: cats,
          dateFormat: "iso",
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const labels = wrapper
        .findAll('[data-testid="category-tick"]')
        .map((t) => t.text());
      expect(labels.length).toBeGreaterThan(0);
      for (const l of labels) {
        expect(l).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe("summary lines", () => {
    function lineEl(wrapper: ReturnType<typeof mount>) {
      return wrapper.find('[data-testid="summary-line"]');
    }
    function parsePathPoints(
      d: string,
    ): { cmd: "M" | "L"; x: number; y: number }[] {
      const out: { cmd: "M" | "L"; x: number; y: number }[] = [];
      const re = /([ML])([-\d.]+),([-\d.]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(d))) {
        out.push({
          cmd: m[1] as "M" | "L",
          x: parseFloat(m[2]),
          y: parseFloat(m[3]),
        });
      }
      return out;
    }

    it("renders a path with one point per data entry by default", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30, 40],
          categories: ["A", "B", "C", "D"],
          summaryLines: [{ data: [1, 2, 3, 4] }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const path = lineEl(wrapper);
      expect(path.exists()).toBe(true);
      const pts = parsePathPoints(path.attributes("d") ?? "");
      expect(pts.length).toBe(4);
      expect(pts[0].cmd).toBe("M");
      expect(pts.slice(1).every((p) => p.cmd === "L")).toBe(true);
    });

    it("scales to its own extent independent of the bars", () => {
      // Bars in 0..500, line in 0..0.02. Line max should pin to top of plot.
      const wrapper = mount(BarChart, {
        props: {
          data: [100, 200, 500, 200, 100],
          categories: ["a", "b", "c", "d", "e"],
          summaryLines: [{ data: [0.005, 0.01, 0.02, 0.01, 0.005] }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const pts = parsePathPoints(lineEl(wrapper).attributes("d") ?? "");
      // The line's own max (0.02) is at index 2 — its y should be the
      // minimum (topmost) of all points.
      const ys = pts.map((p) => p.y);
      expect(Math.min(...ys)).toBeCloseTo(ys[2], 2);
      // And the line's min (0.005) at indices 0 and 4 should be the
      // bottom of the line — but well above the plot bottom (where a
      // bar of value 100 against a 500 max sits).
      expect(ys[0]).toBeLessThan(180); // above plot bottom (y=180-ish)
      expect(ys[0]).toBeGreaterThan(ys[2]);
    });

    it("respects valueMin/valueMax overrides", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["a", "b", "c"],
          summaryLines: [{ data: [0.5, 0.6, 0.7], valueMin: 0, valueMax: 1 }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const pts = parsePathPoints(lineEl(wrapper).attributes("d") ?? "");
      // y=0.5 with [0,1] extent should sit at the vertical midpoint of
      // the inner plot. With height=200 and standard padding, inner h is
      // close to 160 — midpoint y ≈ 100.
      expect(pts[0].y).toBeGreaterThan(80);
      expect(pts[0].y).toBeLessThan(140);
    });

    it("places points at custom x positions in category-index space", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30, 40],
          categories: ["a", "b", "c", "d"],
          summaryLines: [
            { data: [0, 1], x: [0, 3] }, // first and last category centers
          ],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const pts = parsePathPoints(lineEl(wrapper).attributes("d") ?? "");
      expect(pts.length).toBe(2);
      // Two points should be far apart horizontally (spanning the chart).
      expect(Math.abs(pts[1].x - pts[0].x)).toBeGreaterThan(200);
    });

    it("applies color, strokeWidth, and dashed", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["a", "b", "c"],
          summaryLines: [
            { data: [1, 2, 3], color: "#ff0000", strokeWidth: 4, dashed: true },
          ],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const path = lineEl(wrapper);
      expect(path.attributes("stroke")).toBe("#ff0000");
      expect(path.attributes("stroke-width")).toBe("4");
      expect(path.attributes("stroke-dasharray")).toBe("6 3");
    });

    it("draws dots when dots is true", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["a", "b", "c"],
          summaryLines: [{ data: [1, 2, 3], dots: true }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      // 3 dots from the summary line (BarChart itself draws no other circles)
      expect(wrapper.findAll("circle").length).toBe(3);
    });

    it("skips non-finite points without breaking the path", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30, 40],
          categories: ["a", "b", "c", "d"],
          summaryLines: [{ data: [1, NaN, 3, 4] }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const d = lineEl(wrapper).attributes("d") ?? "";
      const pts = parsePathPoints(d);
      // 3 finite points; second segment restarts with M after the gap.
      expect(pts.length).toBe(3);
      expect(pts[0].cmd).toBe("M");
      expect(pts[1].cmd).toBe("M");
      expect(pts[2].cmd).toBe("L");
    });

    it("adds a line entry to the inline legend", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          categories: ["a", "b", "c"],
          series: [{ data: [10, 20, 30], legend: "Bars", color: "#0057b7" }],
          summaryLines: [{ data: [1, 2, 3], legend: "KDE", color: "#ef4444" }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      // The legend renders a <line> element for line items and a <rect>
      // for bar items. Confirm both are present with matching colors.
      const legendLines = wrapper
        .findAll("line")
        .filter((l) => l.attributes("stroke") === "#ef4444");
      expect(legendLines.length).toBeGreaterThan(0);
    });

    it("renders in horizontal orientation along the value axis", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30, 40],
          categories: ["a", "b", "c", "d"],
          orientation: "horizontal",
          summaryLines: [{ data: [1, 2, 3, 4] }],
          width: 400,
          height: 200,
          menu: false,
        },
      });
      const pts = parsePathPoints(lineEl(wrapper).attributes("d") ?? "");
      expect(pts.length).toBe(4);
      // In horizontal mode, the line should advance along the *y* axis
      // (category axis) and grow along the *x* axis (value axis).
      const ys = pts.map((p) => p.y);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i]).toBeGreaterThan(ys[i - 1]);
      }
    });
  });

  describe("value axis", () => {
    it("renders value ticks by default", () => {
      const wrapper = mount(BarChart, {
        props: { data: [10, 20, 30], width: 400, height: 200, menu: false },
      });
      expect(
        wrapper.findAll('[data-testid="value-tick"]').length,
      ).toBeGreaterThan(0);
    });

    it("hides the value axis line, grid, and ticks when valueAxis is false", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20, 30],
          width: 400,
          height: 200,
          menu: false,
          valueAxis: false,
        },
      });
      expect(wrapper.findAll('[data-testid="value-tick"]').length).toBe(0);
      // Category ticks remain visible.
      expect(
        wrapper.findAll('[data-testid="category-tick"]').length,
      ).toBeGreaterThan(0);
    });
  });

  describe("barLabels", () => {
    function labels(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll('[data-testid="bar-label"]');
    }

    it("renders no labels by default", () => {
      const wrapper = mount(BarChart, {
        props: { data: [10, 20, 30], width: 400, height: 200, menu: false },
      });
      expect(labels(wrapper).length).toBe(0);
    });

    it("renders one label per bar when enabled", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [50, 30, 20] }, { data: [10, 40, 50] }],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 200,
          menu: false,
          barLabels: true,
        },
      });
      expect(labels(wrapper).length).toBe(6);
    });

    it("applies a custom format function for label text", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [99.4, 0.3, 0.3],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          barLabels: {
            format: (v: number) =>
              v >= 99 ? ">99%" : v < 1 ? "<1%" : String(Math.round(v)),
          },
        },
      });
      const texts = labels(wrapper).map((n) => n.text());
      expect(texts).toContain(">99%");
      expect(texts).toContain("<1%");
    });

    it("omits a label when the formatter returns an empty string", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [50, 50],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          barLabels: { format: (v: number) => (v > 40 ? "" : String(v)) },
        },
      });
      expect(labels(wrapper).length).toBe(0);
    });

    it("picks a contrasting fill for inside labels (white on dark)", () => {
      const wrapper = mount(BarChart, {
        props: {
          series: [{ data: [80], color: "#2a1a4a" }],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          barLabels: true,
        },
      });
      // The single wide segment fits its label inside → contrast color.
      expect(labels(wrapper)[0].attributes("fill")).toBe("#ffffff");
    });

    it("honors a fixed label color", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [80],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          barLabels: { color: "red" },
        },
      });
      expect(labels(wrapper)[0].attributes("fill")).toBe("red");
    });

    it("places a small segment's label outside (start-anchored past the edge)", () => {
      const wrapper = mount(BarChart, {
        props: {
          // Tiny segment first so its outside label has room to the right.
          series: [
            { data: [1], color: "#9b7cc4" },
            { data: [99], color: "#2a1a4a" },
          ],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          barLabels: true,
        },
      });
      const all = labels(wrapper);
      // Big segment label sits inside (middle-anchored); the tiny one is
      // forced outside (start-anchored) since its text can't fit.
      const tiny = all.find((n) => n.text() === "1")!;
      expect(tiny.attributes("text-anchor")).toBe("start");
      const big = all.find((n) => n.text() === "99")!;
      expect(big.attributes("text-anchor")).toBe("middle");
    });

    it("contrasts an overflow label against the segment it lands on", () => {
      const wrapper = mount(BarChart, {
        props: {
          // Tiny dark segment first; its label overflows onto the light
          // neighbor, so it should be dark for contrast (not currentColor).
          series: [
            { data: [1], color: "#2a1a4a" },
            { data: [99], color: "#e8d9f5" },
          ],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          barLabels: true,
        },
      });
      const tiny = labels(wrapper).find((n) => n.text() === "1")!;
      expect(tiny.attributes("text-anchor")).toBe("start");
      expect(tiny.attributes("fill")).toBe("#1a1a1a");
    });

    it("uses the chart text color when an overflow label clears all bars", () => {
      const wrapper = mount(BarChart, {
        props: {
          // Tiny last segment overflows past the right edge onto the
          // background → currentColor.
          series: [
            { data: [99], color: "#2a1a4a" },
            { data: [1], color: "#8a5fb0" },
          ],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          chartPadding: { right: 40 },
          barLabels: true,
        },
      });
      const tiny = labels(wrapper).find((n) => n.text() === "1")!;
      expect(tiny.attributes("fill")).toBe("currentColor");
    });

    it("left-aligns inside labels to the segment start when align is 'start'", () => {
      const base = {
        series: [{ data: [80] }],
        categories: ["a"],
        orientation: "horizontal" as const,
        layout: "stacked" as const,
        width: 500,
        height: 120,
        menu: false,
      };
      const start = mount(BarChart, {
        props: { ...base, barLabels: { align: "start" } },
      });
      const center = mount(BarChart, { props: { ...base, barLabels: true } });
      const sLabel = labels(start)[0];
      const sx = Number(sLabel.attributes("x"));
      const cx = Number(labels(center)[0].attributes("x"));
      expect(sLabel.attributes("text-anchor")).toBe("start");
      // Start-aligned label sits left of the centered one.
      expect(sx).toBeLessThan(cx);
    });

    it("right-aligns inside labels to the segment end when align is 'end'", () => {
      const base = {
        series: [{ data: [80] }],
        categories: ["a"],
        orientation: "horizontal" as const,
        layout: "stacked" as const,
        width: 500,
        height: 120,
        menu: false,
      };
      const end = mount(BarChart, {
        props: { ...base, barLabels: { align: "end" } },
      });
      const center = mount(BarChart, { props: { ...base, barLabels: true } });
      const eLabel = labels(end)[0];
      expect(eLabel.attributes("text-anchor")).toBe("end");
      expect(Number(eLabel.attributes("x"))).toBeGreaterThan(
        Number(labels(center)[0].attributes("x")),
      );
    });

    it("hides overlapping labels when overlap is 'hide'", () => {
      // Many tiny adjacent segments whose outside labels would collide.
      const wrapper = mount(BarChart, {
        props: {
          series: Array.from({ length: 8 }, () => ({ data: [1] })),
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 120,
          height: 80,
          menu: false,
          barLabels: { overlap: "hide" },
        },
      });
      const shifted = mount(BarChart, {
        props: {
          series: Array.from({ length: 8 }, () => ({ data: [1] })),
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 120,
          height: 80,
          menu: false,
          barLabels: { overlap: "shift" },
        },
      });
      // "hide" drops colliding labels, so it shows no more than "shift".
      expect(labels(wrapper).length).toBeLessThanOrEqual(
        labels(shifted).length,
      );
      expect(labels(wrapper).length).toBeLessThan(8);
    });
  });

  describe("column headers", () => {
    it("renders no headers by default", () => {
      const wrapper = mount(BarChart, {
        props: { data: [10, 20], width: 400, height: 200, menu: false },
      });
      expect(wrapper.find('[data-testid="category-header"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="value-header"]').exists()).toBe(false);
    });

    it("renders category and value headers with their text", () => {
      const wrapper = mount(BarChart, {
        props: {
          data: [10, 20],
          categories: ["a", "b"],
          orientation: "horizontal",
          width: 500,
          height: 200,
          menu: false,
          categoryHeader: "Scenario",
          valueHeader: "Proportion",
        },
      });
      const ch = wrapper.find('[data-testid="category-header"]');
      const vh = wrapper.find('[data-testid="value-header"]');
      expect(ch.text()).toBe("Scenario");
      expect(vh.text()).toBe("Proportion");
      // Category header is right-aligned to match the category labels;
      // value header starts where the bars do.
      expect(ch.attributes("text-anchor")).toBe("end");
      expect(vh.attributes("text-anchor")).toBe("start");
    });

    it("left-aligns category labels (and the header) when categoryAlign is 'start'", () => {
      const props = {
        data: [10, 20],
        categories: ["Alpha", "Beta"],
        orientation: "horizontal" as const,
        width: 500,
        height: 200,
        menu: false,
        categoryHeader: "Scenario",
      };
      const end = mount(BarChart, { props });
      const start = mount(BarChart, {
        props: { ...props, categoryAlign: "start" as const },
      });
      const endTick = end.find('[data-testid="category-tick"]');
      const startTick = start.find('[data-testid="category-tick"]');
      // Default right-aligns (anchor end); start switches to anchor start
      // at the left margin, so the label x moves left.
      expect(endTick.attributes("text-anchor")).toBe("end");
      expect(startTick.attributes("text-anchor")).toBe("start");
      expect(Number(startTick.attributes("x"))).toBeLessThan(
        Number(endTick.attributes("x")),
      );
      // The category header follows the same alignment.
      expect(
        start.find('[data-testid="category-header"]').attributes("text-anchor"),
      ).toBe("start");
    });

    it("aligns the title and legend to the category-label start when categoryAlign is 'start'", () => {
      const base = {
        series: [
          { data: [10], legend: "Aye", color: "#333333" },
          { data: [20], legend: "Bee", color: "#999999" },
        ],
        categories: ["Alpha"],
        orientation: "horizontal" as const,
        layout: "stacked" as const,
        width: 500,
        height: 200,
        menu: false,
        title: "My title",
      };
      const def = mount(BarChart, { props: base });
      const start = mount(BarChart, {
        props: { ...base, categoryAlign: "start" as const },
      });
      const titleX = (w: ReturnType<typeof mount>) =>
        Number(
          w
            .findAll("text")
            .find((e) => e.text().includes("My title"))!
            .attributes("x"),
        );
      const legendX = (w: ReturnType<typeof mount>) =>
        Number(
          w
            .findAll("text")
            .find((e) => e.text() === "Aye")!
            .attributes("x"),
        );
      // Both the title and the legend shift left to the category-label start.
      expect(titleX(start)).toBeLessThan(titleX(def));
      expect(legendX(start)).toBeLessThan(legendX(def));
    });

    it("reserves extra top space so headers don't overlap the plot", () => {
      const firstBarY = (w: ReturnType<typeof mount>) =>
        Math.min(...bars(w).map((b) => Number(b.attributes("y"))));
      const without = mount(BarChart, {
        props: {
          data: [10, 20],
          categories: ["a", "b"],
          orientation: "horizontal",
          width: 500,
          height: 200,
          menu: false,
        },
      });
      const withHeaders = mount(BarChart, {
        props: {
          data: [10, 20],
          categories: ["a", "b"],
          orientation: "horizontal",
          width: 500,
          height: 200,
          menu: false,
          categoryHeader: "Scenario",
          valueHeader: "Proportion",
        },
      });
      // Reserving a header row pushes the plot (and its bars) down.
      expect(firstBarY(withHeaders)).toBeGreaterThan(firstBarY(without));
    });
  });
});
