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
});
