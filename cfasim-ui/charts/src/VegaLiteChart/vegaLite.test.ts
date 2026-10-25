import { describe, it, expect } from "vitest";
import { vegaLiteToChart, type VegaLiteSpec } from "./vegaLite.js";

const days = ["2026-01-02", "2026-01-01", "2026-01-03"];
const cases = days.flatMap((date, i) => [
  { date, region: "north", cases: 10 + i, lo: 8 + i, hi: 12 + i },
  { date, region: "east", cases: 20 + i, lo: 18 + i, hi: 22 + i },
]);

function line(spec: VegaLiteSpec, data?: Record<string, unknown>[]) {
  const out = vegaLiteToChart(spec, { data });
  if (out.component !== "LineChart") throw new Error(out.component);
  return out;
}

function bars(spec: VegaLiteSpec) {
  const out = vegaLiteToChart(spec);
  if (out.component !== "BarChart") throw new Error(out.component);
  return out;
}

describe("vegaLiteToChart: LineChart", () => {
  it("splits a color field into series, sorted by x, colored in domain order", () => {
    const { props, warnings } = line({
      title: { text: ["Cases", "by region"] },
      width: 400,
      data: { values: cases },
      mark: { type: "line", interpolate: "monotone", point: true },
      encoding: {
        x: { field: "date", type: "temporal", title: "Day" },
        y: { field: "cases", type: "quantitative" },
        color: { field: "region", type: "nominal" },
      },
    });
    expect(warnings).toEqual([]);
    expect(props).toMatchObject({
      title: "Cases\nby region",
      width: 400,
      xLabel: "Day",
      yLabel: "cases",
    });
    // Vega-Lite sorts a nominal domain ascending: east before north.
    expect(props.series!.map((s) => [s.legend, s.color, s.y])).toEqual([
      ["east", "var(--color-primary, #3b82f6)", [21, 20, 22]],
      ["north", "var(--color-accent, #f59e0b)", [11, 10, 12]],
    ]);
    expect(props.series![0]).toMatchObject({
      x: ["2026-01-01", "2026-01-02", "2026-01-03"],
      curve: "monotone",
      dots: true,
    });
  });

  it("layers a band, a line and points, inheriting data and encodings", () => {
    const { props } = line({
      data: { values: cases.filter((r) => r.region === "north") },
      encoding: { x: { field: "date", type: "temporal" } },
      layer: [
        {
          mark: { type: "area", opacity: 0.3 },
          encoding: {
            y: { field: "lo", type: "quantitative" },
            y2: { field: "hi" },
          },
        },
        {
          mark: "point",
          encoding: { y: { field: "cases", type: "quantitative" } },
        },
      ],
    });
    expect(props.areas).toEqual([
      expect.objectContaining({
        opacity: 0.3,
        // y is the lower bound here; the band still runs lower to upper.
        upper: [13, 12, 14],
        lower: [9, 8, 10],
      }),
    ]);
    expect(props.series![0]).toMatchObject({ line: false, dots: true });
  });

  it("stacks colored areas, and normalizes on request", () => {
    const spec = (stack?: "normalize"): VegaLiteSpec => ({
      data: { values: cases },
      mark: "area",
      encoding: {
        x: { field: "date", type: "temporal" },
        y: { field: "cases", type: "quantitative", ...(stack && { stack }) },
        color: { field: "region", type: "nominal" },
      },
    });
    const stacked = line(spec()).props.areas!;
    expect(Array.from(stacked[1].upper)).toEqual([32, 30, 34]);
    expect(Array.from(stacked[1].value!)).toEqual([11, 10, 12]);
    const shares = line(spec("normalize")).props.areas!;
    expect(Array.from(shares[1].upper)).toEqual([1, 1, 1]);
  });

  it("indexes a discrete x and labels its ticks", () => {
    const { props } = line({
      data: {
        values: [
          { g: "b", v: 2 },
          { g: "a", v: 1 },
        ],
      },
      mark: "line",
      encoding: {
        x: { field: "g", type: "ordinal" },
        y: { field: "v", type: "quantitative" },
      },
    });
    expect(props.series![0]).toMatchObject({ x: [0, 1], y: [1, 2] });
    expect(props.xTicks).toEqual([0, 1]);
    expect((props.xTickFormat as (v: number) => string)(1)).toBe("b");
  });

  it("maps axis formats, titles, grids and the y scale", () => {
    const { props } = line({
      data: { values: [{ t: Date.UTC(2026, 0, 4), v: 0.25 }] },
      mark: "line",
      encoding: {
        x: {
          field: "t",
          type: "temporal",
          axis: { format: "%b %d", title: null },
        },
        y: {
          field: "v",
          type: "quantitative",
          scale: { type: "log", domain: [0.01, 1] },
          axis: { format: ".0%", title: "Share", grid: true },
        },
      },
    });
    expect(props.series![0].x).toEqual([new Date(Date.UTC(2026, 0, 4))]);
    expect(props).toMatchObject({
      yLabel: "Share",
      yGrid: true,
      yScaleType: "log",
      yMin: 0.01,
      yMax: 1,
    });
    expect(props.xLabel).toBeUndefined();
    expect(
      (props.xTickFormat as (v: number) => string)(Date.UTC(2026, 0, 4)),
    ).toBe("Jan 04");
    expect((props.yTickFormat as (v: number) => string)(0.25)).toBe("25%");
  });

  it("drops rows with a missing position and reads nested fields", () => {
    const { props } = line(
      {
        mark: "line",
        encoding: {
          x: { field: "p.x", type: "quantitative" },
          y: { field: "p.y", type: "quantitative" },
        },
      },
      [{ p: { x: 2, y: 4 } }, { p: { x: 1, y: null } }, { p: { x: 0, y: 1 } }],
    );
    expect(props.series![0]).toMatchObject({ x: [0, 2], y: [1, 4] });
  });
});

describe("vegaLiteToChart: BarChart", () => {
  const counts = [
    { day: "Tue", group: "a", n: 2 },
    { day: "Mon", group: "a", n: 1 },
    { day: "Mon", group: "b", n: 3 },
    { day: "Tue", group: "b", n: 6 },
  ];

  it("stacks colored bars by default, groups with an offset, overlays without a stack", () => {
    const spec = (extra: object = {}, y: object = {}): VegaLiteSpec => ({
      data: { values: counts },
      mark: "bar",
      encoding: {
        x: { field: "day", type: "nominal" },
        y: { field: "n", type: "quantitative", ...y },
        color: { field: "group", type: "nominal" },
        ...extra,
      },
    });
    const stacked = bars(spec()).props;
    expect(stacked).toMatchObject({
      layout: "stacked",
      categories: ["Mon", "Tue"],
    });
    expect(stacked.series!.map((s) => [s.legend, s.data])).toEqual([
      ["a", [1, 2]],
      ["b", [3, 6]],
    ]);
    expect(stacked.categoryFormat!("2026-01-01", 0)).toBe("2026-01-01");
    const grouped = { xOffset: { field: "group", type: "nominal" } };
    expect(bars(spec(grouped)).props.layout).toBe("grouped");
    expect(bars(spec({}, { stack: null })).props.layout).toBe("overlay");
    const shares = bars(spec({}, { stack: "normalize" })).props.series!;
    expect(shares.map((s) => s.data)).toEqual([
      [0.25, 0.25],
      [0.75, 0.75],
    ]);
  });

  it("sorts categories by a channel's sum, and groups by an offset field alone", () => {
    const sorted = bars({
      data: { values: counts },
      mark: "bar",
      encoding: {
        x: { field: "day", type: "nominal", sort: "-y" },
        y: { field: "n", type: "quantitative" },
        xOffset: { field: "group", type: "nominal" },
      },
    });
    // Tue sums to 8, Mon to 4.
    expect(sorted.props).toMatchObject({
      categories: ["Tue", "Mon"],
      layout: "grouped",
    });
    expect(sorted.props.series!.map((s) => s.data)).toEqual([
      [2, 1],
      [6, 3],
    ]);
    const { warnings } = bars({
      data: { values: counts },
      mark: "bar",
      encoding: {
        x: { field: "day", type: "nominal", sort: { op: "max" } },
        y: { field: "n", type: "quantitative" },
      },
    });
    expect(warnings).toEqual([
      "an object `sort` is not supported; sort by a channel or an array",
      "several rows share a bar; the first one is plotted",
    ]);
  });

  it("lays bars along a quantitative x when y is temporal", () => {
    const { props } = bars({
      data: { values: [{ t: "2026-01-01", n: 3 }] },
      mark: "bar",
      encoding: {
        x: { field: "n", type: "quantitative" },
        y: { field: "t", type: "temporal" },
      },
    });
    expect(props.orientation).toBe("horizontal");
    expect(props.series![0]).toMatchObject({ x: ["2026-01-01"], data: [3] });
  });

  it("lays a discrete y out horizontally, with a value domain and format", () => {
    const { props } = bars({
      data: { values: counts.filter((r) => r.group === "a") },
      mark: { type: "bar", color: "teal" },
      encoding: {
        y: { field: "day", type: "nominal" },
        x: {
          field: "n",
          type: "quantitative",
          scale: { domain: [0, 10] },
          axis: { format: ",d" },
        },
      },
    });
    expect(props).toMatchObject({
      orientation: "horizontal",
      valueMin: 0,
      valueMax: 10,
      xLabel: "n",
      yLabel: "day",
    });
    expect(props.series![0]).toMatchObject({ data: [1, 2], color: "teal" });
    expect((props.valueTickFormat as (v: number) => string)(1200)).toBe(
      "1,200",
    );
  });

  it("puts temporal bars on a continuous axis and layers lines and points on the bar scale", () => {
    const { props } = bars({
      data: {
        values: [
          // Out of order: summary lines are sorted along the axis.
          { t: "2026-01-02", n: 6, avg: 5 },
          { t: "2026-01-01", n: 4, avg: 3 },
        ],
      },
      encoding: { x: { field: "t", type: "temporal" } },
      layer: [
        { mark: "bar", encoding: { y: { field: "n", type: "quantitative" } } },
        {
          mark: { type: "line", interpolate: "step-after", color: "red" },
          encoding: { y: { field: "avg", type: "quantitative" } },
        },
        {
          mark: "point",
          encoding: { y: { field: "avg", type: "quantitative" } },
        },
      ],
    });
    expect(props.categories).toBeUndefined();
    expect(props.series![0]).toMatchObject({
      x: ["2026-01-02", "2026-01-01"],
      data: [6, 4],
    });
    expect(props.summaryLines).toEqual([
      expect.objectContaining({
        scale: "shared",
        curve: "step-after",
        color: "red",
        data: [3, 5],
      }),
      expect.objectContaining({ scale: "shared", dots: true, strokeWidth: 0 }),
    ]);
  });
});

describe("vegaLiteToChart: unsupported pieces", () => {
  it("warns about each skipped piece once and still renders", () => {
    const { component, props, warnings } = vegaLiteToChart(
      {
        config: { view: { stroke: null } },
        transform: [{ filter: "datum.n > 1" }],
        data: { url: "data/cars.json" },
        facet: { row: { field: "origin" } },
        layer: [
          {
            mark: { type: "line", interpolate: "basis" },
            encoding: {
              x: { field: "t", type: "quantitative", timeUnit: "month" },
              y: { field: "n", type: "quantitative", aggregate: "mean" },
              color: {
                field: "g",
                type: "nominal",
                scale: { scheme: "tableau10" },
              },
            },
          },
          { mark: "geoshape" },
          {
            mark: "line",
            encoding: {
              x: { field: "t", type: "quantitative" },
              y: { field: "n", type: "quantitative", aggregate: "mean" },
            },
          },
        ],
      },
      { data: [{ t: 1, n: 2, g: "a" }] },
    );
    expect(component).toBe("LineChart");
    expect(props.series).toHaveLength(2);
    expect(warnings).toEqual([
      "`facet` is not supported",
      "`config` is ignored; style the chart with its props",
      "`transform` is not supported; pass rows that are ready to plot",
      "`x.timeUnit` is not applied; values are plotted as given",
      "`y.aggregate` is not applied; values are plotted as given",
      '`interpolate: "basis"` is not supported',
      "`color.scale.scheme` is not supported; use `scale.range`",
      "a `geoshape` layer needs `x` and `y` fields",
    ]);
  });

  it("asks for rows only when a url spec gets none", () => {
    const spec: VegaLiteSpec = {
      data: { url: "cars.json" },
      mark: "line",
      encoding: {
        x: { field: "a", type: "quantitative" },
        y: { field: "b", type: "quantitative" },
      },
    };
    expect(vegaLiteToChart(spec).warnings).toEqual([
      "only inline `data.values` is supported; pass rows with the `data` option",
    ]);
    expect(() =>
      vegaLiteToChart(spec, { data: [], strict: true }),
    ).not.toThrow();
  });

  it("throws on the first unsupported piece with strict", () => {
    expect(() =>
      vegaLiteToChart(
        { mark: "line", transform: [{ filter: "true" }] },
        { strict: true },
      ),
    ).toThrow("Vega-Lite: `transform` is not supported");
  });
});
