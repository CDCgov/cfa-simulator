import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import BarChart from "./BarChart.vue";

// A 600px-wide chart with no axis labels has a 540px plot starting at x = 50.
const PLOT_LEFT = 50;
const PLOT_W = 540;

type Wrapper = ReturnType<typeof mount>;

function bars(wrapper: Wrapper) {
  return wrapper.findAll('[data-testid="bar"]');
}

function centers(wrapper: Wrapper) {
  return bars(wrapper).map(
    (b) => Number(b.attributes("x")) + Number(b.attributes("width")) / 2,
  );
}

function csv(wrapper: Wrapper) {
  const href = wrapper.find("a.bar-chart-download-link").attributes("href")!;
  return decodeURIComponent(href).split(",").slice(1).join(",");
}

const base = { width: 600, height: 300, menu: false };

describe("BarChart continuous x", () => {
  afterEach(() => vi.restoreAllMocks());

  it("places bars at their x, so gaps in the data show", () => {
    const wrapper = mount(BarChart, {
      props: { ...base, data: [5, 6, 7], x: [0, 1, 3] },
    });
    // Auto width is the smallest gap (1): the domain is [-0.5, 3.5].
    const unit = PLOT_W / 4;
    const got = centers(wrapper);
    expect(got[0]).toBeCloseTo(PLOT_LEFT + 0.5 * unit);
    expect(got[1]).toBeCloseTo(PLOT_LEFT + 1.5 * unit);
    expect(got[2]).toBeCloseTo(PLOT_LEFT + 3.5 * unit);
    expect(Number(bars(wrapper)[0].attributes("width"))).toBeCloseTo(
      unit * 0.8,
    );
  });

  it("labels a numeric axis with ticks, not one label per bar", () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        data: Array.from({ length: 40 }, (_, i) => i),
        x: Array.from({ length: 40 }, (_, i) => i * 0.5),
      },
    });
    const ticks = wrapper
      .findAll('[data-testid="category-tick"]')
      .map((t) => Number(t.text()));
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.length).toBeLessThan(12);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it("spans [x, x + period) on a date axis and titles the tooltip with it", async () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        data: [3, 4, 5],
        // The week of Jan 19 has no row.
        x: ["2026-01-05", "2026-01-12", "2026-01-26"],
        period: "week" as const,
        barPadding: 0,
        tooltipTrigger: "hover" as const,
      },
      attachTo: document.body,
    });
    const rects = bars(wrapper);
    const widths = rects.map((b) => Number(b.attributes("width")));
    // Four weeks of axis for three bars: each week is a quarter of it.
    for (const w of widths) expect(w).toBeCloseTo(PLOT_W / 4);
    expect(Number(rects[2].attributes("x"))).toBeCloseTo(
      PLOT_LEFT + (3 * PLOT_W) / 4,
    );

    const overlay = wrapper.find('[data-testid="chart-overlay"]');
    await overlay.trigger("mousemove", {
      clientX: PLOT_LEFT + PLOT_W / 8,
      clientY: 100,
    });
    expect(wrapper.find(".chart-tooltip-label").text()).toBe(
      "2026-01-05 – 2026-01-11",
    );
    wrapper.unmount();
  });

  it("follows month lengths with a calendar period", () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        data: [1, 2],
        x: ["2026-01-01", "2026-02-01"],
        period: "month" as const,
        barPadding: 0,
      },
    });
    const [jan, feb] = bars(wrapper).map((b) => Number(b.attributes("width")));
    expect(jan / feb).toBeCloseTo(31 / 28);
  });

  it("draws uneven bins from x2", () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        data: [4, 8],
        x: [0, 1],
        x2: [1, 4],
        barPadding: 0,
      },
    });
    const [a, b] = bars(wrapper).map((r) => Number(r.attributes("width")));
    expect(b / a).toBeCloseTo(3);
  });

  it("lets series share slots by x, grouping and stacking within them", () => {
    const series = [
      { data: [1, 2, 3], x: [0, 1, 2] },
      { data: [4, 5], x: [1, 2] },
    ];
    const grouped = mount(BarChart, { props: { ...base, series } });
    // Series B has no bar at x = 0.
    expect(bars(grouped).length).toBe(5);
    expect(bars(grouped).map((b) => b.attributes("data-category"))).toEqual([
      "0",
      "1",
      "1",
      "2",
      "2",
    ]);

    const stacked = mount(BarChart, {
      props: { ...base, series, layout: "stacked" as const },
    });
    const atOne = bars(stacked).filter(
      (b) => b.attributes("data-category") === "1",
    );
    expect(atOne.map((b) => b.attributes("x"))).toEqual([
      atOne[0].attributes("x"),
      atOne[0].attributes("x"),
    ]);
  });

  it("applies the chart-level x to series without their own", () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        x: [0, 1, 5],
        series: [{ data: [1, 2, 3] }, { data: [3, 2, 1] }],
      },
    });
    expect(bars(wrapper).length).toBe(6);
    const got = centers(wrapper);
    // The last pair sits far right of the first two.
    expect(got[4] - got[2]).toBeGreaterThan(3 * (got[2] - got[0]));
  });

  it("exports x and, with explicit spans, x_end", () => {
    const auto = mount(BarChart, {
      props: { ...base, data: [1, 2], x: [0, 2], downloadLink: true },
    });
    expect(csv(auto)).toBe("x,value\n0,1\n2,2");

    const weekly = mount(BarChart, {
      props: {
        ...base,
        data: [1, 2],
        x: ["2026-01-05", "2026-01-12"],
        period: "week" as const,
        downloadLink: true,
      },
    });
    expect(csv(weekly)).toBe(
      "x,x_end,value\n2026-01-05,2026-01-12,1\n2026-01-12,2026-01-19,2",
    );
  });

  it("hovers the slot under the pointer", async () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        data: [1, 2, 3],
        x: [0, 1, 3],
        tooltipTrigger: "hover" as const,
      },
      attachTo: document.body,
    });
    const overlay = wrapper.find('[data-testid="chart-overlay"]');
    const unit = PLOT_W / 4;
    await overlay.trigger("mousemove", {
      clientX: PLOT_LEFT + 3.4 * unit,
      clientY: 100,
    });
    expect(wrapper.emitted("hover")!.at(-1)![0]).toEqual({ index: 2 });
    wrapper.unmount();
  });

  it("centers whiskers and places standalone intervals in axis units", () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        series: [{ data: [5, 6], lower: [4, 5], upper: [6, 7] }],
        x: [0, 4],
        period: 2,
        intervals: [{ x: 3, lower: 1, upper: 2 }],
      },
    });
    const lines = wrapper
      .findAll('[data-testid="interval"] line.interval-line')
      .map((l) => Number(l.attributes("x1")));
    const unit = PLOT_W / 6;
    // Whiskers at the span centers (1 and 5), the standalone one at x = 3.
    expect(lines[0]).toBeCloseTo(PLOT_LEFT + unit);
    expect(lines[1]).toBeCloseTo(PLOT_LEFT + 5 * unit);
    expect(lines[2]).toBeCloseTo(PLOT_LEFT + 3 * unit);
  });

  it("zooms to a brushed x range and resets", async () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        data: Array.from({ length: 10 }, (_, i) => i + 1),
        x: Array.from({ length: 10 }, (_, i) => i),
        zoom: true,
      },
    });
    const overlay = wrapper.find('[data-testid="chart-overlay"]');
    const slot = PLOT_W / 10;
    await overlay.trigger("pointerdown", {
      clientX: PLOT_LEFT + 2 * slot,
      button: 0,
    });
    const to = { clientX: PLOT_LEFT + 5 * slot };
    window.dispatchEvent(new MouseEvent("pointermove", to));
    window.dispatchEvent(new MouseEvent("pointerup", to));
    await wrapper.vm.$nextTick();

    // Slots 2..4 fill the plot; their neighbors' bars are clipped away.
    expect(bars(wrapper).map((b) => b.attributes("data-category"))).toEqual([
      "2",
      "3",
      "4",
    ]);
    expect(Number(bars(wrapper)[0].attributes("width"))).toBeCloseTo(
      (PLOT_W / 3) * 0.8,
    );
    await wrapper.find('[aria-label="Reset zoom"]').trigger("click");
    expect(bars(wrapper).length).toBe(10);
  });

  it("lays a continuous axis down the side in horizontal orientation", () => {
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        data: [1, 2, 3],
        x: [0, 1, 3],
        orientation: "horizontal" as const,
      },
    });
    const ys = bars(wrapper).map(
      (b) => Number(b.attributes("y")) + Number(b.attributes("height")) / 2,
    );
    expect(ys[2] - ys[1]).toBeCloseTo(2 * (ys[1] - ys[0]));
  });

  it("skips a series without x on a date axis, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(BarChart, {
      props: {
        ...base,
        series: [
          { data: [1, 2], x: ["2026-01-05", "2026-01-12"] },
          { data: [3, 4] },
        ],
      },
    });
    expect(bars(wrapper).length).toBe(2);
    expect(warn).toHaveBeenCalled();
  });

  it("ignores categories with a warning when x is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(BarChart, {
      props: { ...base, data: [1, 2], x: [0, 1], categories: ["a", "b"] },
    });
    expect(warn).toHaveBeenCalled();
    expect(
      wrapper.findAll('[data-testid="category-tick"]').map((t) => t.text()),
    ).not.toContain("a");
  });
});
