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
      ["north", "#f97316", [11, 10, 12]],
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

describe("vegaLiteToChart: rules, error bars and text", () => {
  const pts = [
    { t: "2026-01-02", v: 2, lo: 1, hi: 3, label: "b" },
    { t: "2026-01-01", v: 1, lo: 0, hi: 2, label: "a" },
  ];

  it("draws full-span rules as annotations, widening y to reach them", () => {
    const { props } = line(
      {
        layer: [
          {
            mark: "line",
            encoding: {
              x: { field: "t", type: "temporal" },
              y: { field: "v", type: "quantitative" },
            },
          },
          {
            mark: { type: "rule", color: "red", strokeDash: [4, 2] },
            encoding: { y: { datum: 10 } },
          },
          { mark: "rule", encoding: { x: { datum: "2026-01-02" } } },
        ],
      },
      pts,
    );
    expect(props.yMax).toBe(10);
    // Each rule is anchored on the first point for the coordinate it ignores.
    expect(props.annotations).toEqual([
      expect.objectContaining({
        pointer: "ruleY",
        y: 10,
        x: Date.UTC(2026, 0, 1),
        lineColor: "red",
        lineDash: [4, 2],
      }),
      expect.objectContaining({
        pointer: "ruleX",
        x: Date.UTC(2026, 0, 2),
        y: 1,
      }),
    ]);
    // An explicit domain wins over the rule.
    const capped = line(
      {
        layer: [
          {
            mark: "line",
            encoding: {
              x: { field: "t", type: "temporal" },
              y: {
                field: "v",
                type: "quantitative",
                scale: { domain: [0, 5] },
              },
            },
          },
          { mark: "rule", encoding: { y: { datum: 10 } } },
        ],
      },
      pts,
    );
    expect(capped.props.yMax).toBe(5);
  });

  it("turns error bars and y/y2 rules into intervals, text into labels, error bands into areas", () => {
    const { props } = line(
      {
        encoding: { x: { field: "t", type: "temporal" } },
        layer: [
          {
            mark: "errorbar",
            encoding: {
              y: { field: "hi", type: "quantitative" },
              y2: { field: "lo" },
            },
          },
          {
            mark: "rule",
            encoding: {
              y: { field: "lo", type: "quantitative" },
              y2: { field: "hi" },
            },
          },
          {
            mark: "text",
            encoding: {
              y: { field: "v", type: "quantitative" },
              text: { field: "label" },
            },
          },
          {
            mark: "errorband",
            encoding: {
              y: { field: "lo", type: "quantitative" },
              y2: { field: "hi" },
            },
          },
        ],
      },
      pts,
    );
    const day = (d: number) => Date.UTC(2026, 0, d);
    expect(props.intervals).toEqual([
      { x: day(2), lower: 1, upper: 3 },
      { x: day(1), lower: 0, upper: 2 },
      { x: day(2), lower: 1, upper: 3, capWidth: 0 },
      { x: day(1), lower: 0, upper: 2, capWidth: 0 },
    ]);
    expect(props.annotations!.map((a) => [a.text, a.x, a.y])).toEqual([
      ["b", day(2), 2],
      ["a", day(1), 1],
    ]);
    expect(props.areas![0]).toMatchObject({ upper: [2, 3], lower: [0, 1] });
  });

  it("puts error bars and value rules on a bar chart's categories", () => {
    const bars = vegaLiteToChart(
      {
        // The rule inherits the shared x field but sets y itself: it is a
        // threshold across the plot, drawn once for its repeated value.
        encoding: { x: { field: "label", type: "nominal" } },
        layer: [
          {
            mark: "bar",
            encoding: { y: { field: "v", type: "quantitative" } },
          },
          {
            mark: "errorbar",
            encoding: {
              y: { field: "lo", type: "quantitative" },
              y2: { field: "hi" },
            },
          },
          {
            mark: "rule",
            encoding: { y: { field: "cap", type: "quantitative" } },
          },
        ],
      },
      {
        data: [
          ...pts.map((r) => ({ ...r, cap: 8 })),
          // Only in the error bars: still a category on the axis.
          { label: "z", lo: 4, hi: 6, cap: 8 },
        ],
      },
    );
    expect(bars.warnings).toEqual([]);
    expect(bars.props).toMatchObject({
      categories: ["a", "b", "z"],
      valueMax: 8,
      intervals: [
        { x: 1, lower: 1, upper: 3 },
        { x: 0, lower: 0, upper: 2 },
        { x: 2, lower: 4, upper: 6 },
      ],
    });
    expect(bars.props.annotations).toEqual([
      expect.objectContaining({ pointer: "ruleY", y: 8 }),
    ]);
  });
});

describe("vegaLiteToChart: point channels and bins", () => {
  const rows = [
    { x: 1, y: 1, s: 0, q: 0 },
    { x: 2, y: 2, s: 10, q: null },
    { x: 3, y: 3, s: 20, q: 4 },
  ];

  it("sizes, fades and shades points from fields", () => {
    const { props } = line(
      {
        mark: "circle",
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
          size: { field: "s", type: "quantitative" },
          opacity: { field: "q", type: "quantitative" },
          color: {
            field: "q",
            type: "quantitative",
            scale: { range: ["#000000", "#ffffff"] },
          },
        },
      },
      rows,
    );
    const s = props.series![0];
    // Size is an area from 9 to 361 px² over a domain from 0.
    expect((s.dotRadius as number[]).map((r) => r.toFixed(2))).toEqual([
      Math.sqrt(9 / Math.PI).toFixed(2),
      Math.sqrt(185 / Math.PI).toFixed(2),
      Math.sqrt(361 / Math.PI).toFixed(2),
    ]);
    // A missing value leaves its dot the default opacity.
    expect(s.dotOpacity).toEqual([0.3, undefined, 0.8]);
    // A missing color value falls back to the series default.
    expect(s.dotFill).toEqual([
      "rgb(0, 0, 0)",
      undefined,
      "rgb(255, 255, 255)",
    ]);
  });

  it("draws `point` marks as outlines unless filled, at Vega-Lite's size", () => {
    const spec = (filled?: boolean): VegaLiteSpec => ({
      mark: { type: "point", color: "teal", ...(filled && { filled }) },
      encoding: {
        x: { field: "x", type: "quantitative" },
        y: { field: "y", type: "quantitative" },
        strokeDash: { value: [2, 2] },
      },
    });
    expect(line(spec(), rows).props.series![0]).toMatchObject({
      dotFill: "none",
      dotStroke: "teal",
      dotRadius: Math.sqrt(30 / Math.PI),
      dashed: true,
    });
    expect(line(spec(true), rows).props.series![0].dotFill).toBeUndefined();
  });

  it("spans pre-binned bars from x to x2", () => {
    const { props } = bars({
      data: { values: [{ a: 0, b: 5, n: 3 }] },
      mark: "bar",
      encoding: {
        x: { field: "a", type: "quantitative", bin: "binned" },
        x2: { field: "b" },
        y: { field: "n", type: "quantitative" },
      },
    });
    expect(props.series![0]).toMatchObject({ x: [0], x2: [5], data: [3] });
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
            mark: "errorband",
            encoding: {
              x: { field: "t", type: "quantitative" },
              y: { field: "n", type: "quantitative" },
            },
          },
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
      "an `errorband` needs `y` and `y2` fields (bounds, not raw values)",
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
