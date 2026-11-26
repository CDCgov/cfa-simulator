import { describe, it, expect } from "vitest";
import { vegaLiteToChart, type VegaLiteSpec } from "./vegaLite.js";

const days = ["2026-01-02", "2026-01-01", "2026-01-03"];
const cases = days.flatMap((date, i) => [
  { date, region: "north", cases: 10 + i, lo: 8 + i, hi: 12 + i },
  { date, region: "east", cases: 20 + i, lo: 18 + i, hi: 22 + i },
]);
const scores = [
  { loc: "NY", model: "b", wis: 2 },
  { loc: "AZ", model: "b", wis: 4 },
  { loc: "AZ", model: "a", wis: 1 },
  { loc: "NY", model: "a", wis: 2 },
];

function translate<T extends "LineChart" | "BarChart" | "Heatmap">(
  expected: T,
  spec: VegaLiteSpec,
  data?: Record<string, unknown>[],
) {
  const result = vegaLiteToChart(spec, { data });
  if (result.component !== expected) throw new Error(result.component);
  return result as Extract<
    ReturnType<typeof vegaLiteToChart>,
    { component: T }
  >;
}

describe("vegaLiteToChart: LineChart", () => {
  it("splits color into sorted series, maps scales/formats, and handles ordinal x", () => {
    const { props, warnings } = translate("LineChart", {
      title: { text: ["Cases", "by region"] },
      width: 400,
      data: { values: cases },
      mark: { type: "line", interpolate: "monotone", point: true },
      encoding: {
        x: {
          field: "date",
          type: "temporal",
          title: "Day",
          scale: { domain: ["2026-01-01", "2026-02-01"] },
          axis: { format: "%b %d" },
        },
        y: {
          field: "cases",
          type: "quantitative",
          scale: { type: "log", domain: [1, 100] },
          axis: { format: ".0%", grid: true },
        },
        color: { field: "region", type: "nominal" },
      },
    });
    expect(warnings).toEqual([]);
    expect(props).toMatchObject({
      title: "Cases\nby region",
      width: 400,
      xLabel: "Day",
      yGrid: true,
      yScaleType: "log",
      xMin: Date.UTC(2026, 0, 1),
      yMin: 1,
      yMax: 100,
    });
    expect(props.series!.map((s) => [s.legend, s.y])).toEqual([
      ["east", [21, 20, 22]],
      ["north", [11, 10, 12]],
    ]);
    expect(props.series![0]).toMatchObject({
      x: ["2026-01-01", "2026-01-02", "2026-01-03"],
      curve: "monotone",
      dots: true,
    });
    expect(
      (props.xTickFormat as (v: number) => string)(Date.UTC(2026, 0, 4)),
    ).toBe("Jan 04");
    expect((props.yTickFormat as (v: number) => string)(0.25)).toBe("25%");

    const discrete = translate("LineChart", {
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
    expect(discrete.props.xTicks).toEqual([0, 1]);
    expect((discrete.props.xTickFormat as (v: number) => string)(1)).toBe("b");
  });

  it("layers bands, errorbars, rules, text, and maps point channels and stacked areas", () => {
    const layered = translate("LineChart", {
      data: { values: cases.filter((row) => row.region === "north") },
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
          mark: "errorbar",
          encoding: {
            y: { field: "hi", type: "quantitative" },
            y2: { field: "lo" },
          },
        },
        {
          mark: "point",
          encoding: { y: { field: "cases", type: "quantitative" } },
        },
        {
          mark: { type: "rule", color: "red" },
          encoding: { y: { datum: 30 } },
        },
        {
          mark: "text",
          encoding: {
            y: { field: "cases", type: "quantitative" },
            text: { field: "region" },
          },
        },
      ],
    });
    expect(layered.props.areas![0]).toMatchObject({
      opacity: 0.3,
      lower: [9, 8, 10],
      upper: [13, 12, 14],
    });
    expect(layered.props.intervals).toHaveLength(3);
    expect(layered.props.yMax).toBe(30);
    expect(layered.props.annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: "ruleY", y: 30, lineColor: "red" }),
      ]),
    );

    const normalized = translate("LineChart", {
      data: { values: cases },
      mark: "area",
      encoding: {
        x: { field: "date", type: "temporal" },
        y: { field: "cases", type: "quantitative", stack: "normalize" },
        color: { field: "region", type: "nominal" },
      },
    });
    expect(Array.from(normalized.props.areas![1].upper)).toEqual([1, 1, 1]);

    const circles = translate(
      "LineChart",
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
            scale: { range: ["#000", "#fff"] },
          },
        },
      },
      [
        { x: 1, y: 1, s: 0, q: 0 },
        { x: 2, y: 2, s: 10, q: null },
        { x: 3, y: 3, s: 20, q: 4 },
      ],
    );
    expect(circles.props.series![0]).toMatchObject({
      dotOpacity: [0.3, undefined, 0.8],
      colorValue: [0, NaN, 4],
    });
    expect(circles.props.colorScale).toEqual({
      range: ["#000", "#fff"],
      label: "q",
    });
  });
});

describe("vegaLiteToChart: BarChart", () => {
  const counts = [
    { day: "Tue", group: "a", n: 2 },
    { day: "Mon", group: "a", n: 1 },
    { day: "Mon", group: "b", n: 3 },
    { day: "Tue", group: "b", n: 6 },
  ];

  it("supports stacked, grouped, overlay, normalized, sorted horizontal, temporal layered, and binned bars", () => {
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
    expect(translate("BarChart", spec()).props).toMatchObject({
      layout: "stacked",
      categories: ["Mon", "Tue"],
    });
    expect(
      translate(
        "BarChart",
        spec({ xOffset: { field: "group", type: "nominal" } }),
      ).props.layout,
    ).toBe("grouped");
    expect(translate("BarChart", spec({}, { stack: null })).props.layout).toBe(
      "overlay",
    );
    expect(
      translate("BarChart", spec({}, { stack: "normalize" })).props.series!.map(
        (s) => s.data,
      ),
    ).toEqual([
      [0.25, 0.25],
      [0.75, 0.75],
    ]);

    const horizontal = translate("BarChart", {
      data: { values: counts },
      mark: "bar",
      encoding: {
        y: { field: "day", type: "nominal", sort: "-x" },
        x: { field: "n", type: "quantitative" },
        yOffset: { field: "group", type: "nominal" },
      },
    });
    expect(horizontal.props).toMatchObject({
      orientation: "horizontal",
      categories: ["Tue", "Mon"],
      layout: "grouped",
    });

    const layered = translate("BarChart", {
      data: {
        values: [
          { t: "2026-01-02", n: 6, avg: 5 },
          { t: "2026-01-01", n: 4, avg: 3 },
        ],
      },
      encoding: { x: { field: "t", type: "temporal" } },
      layer: [
        { mark: "bar", encoding: { y: { field: "n", type: "quantitative" } } },
        {
          mark: { type: "line", color: "red" },
          encoding: { y: { field: "avg", type: "quantitative" } },
        },
      ],
    });
    expect(layered.props.summaryLines).toEqual([
      expect.objectContaining({ scale: "shared", color: "red", data: [3, 5] }),
    ]);

    const binned = translate("BarChart", {
      data: { values: [{ a: 0, b: 5, n: 3 }] },
      mark: "bar",
      encoding: {
        x: { field: "a", type: "quantitative", bin: "binned" },
        x2: { field: "b" },
        y: { field: "n", type: "quantitative" },
      },
    });
    expect(binned.props.series![0]).toMatchObject({
      x: [0],
      x2: [5],
      data: [3],
    });
  });
});

describe("vegaLiteToChart: Heatmap & unsupported", () => {
  it("pivots rect marks with diverging domains, text layers, and warns on invalid channels", () => {
    const { props, warnings } = translate("Heatmap", {
      data: { values: scores },
      encoding: {
        x: {
          field: "model",
          type: "nominal",
          axis: { orient: "top", labelAngle: -30 },
        },
        y: { field: "loc", type: "ordinal", sort: "-color", axis: null },
      },
      layer: [
        {
          mark: { type: "rect", cornerRadius: 2 },
          encoding: {
            color: {
              field: "wis",
              type: "quantitative",
              scale: { domain: [0, 2, 4], range: ["#00f", "#fff", "#f00"] },
              legend: { title: "WIS", format: ".1f" },
            },
          },
        },
        {
          mark: { type: "text", color: "white", fontSize: 9 },
          encoding: { text: { field: "wis", format: ".2f" } },
        },
        { mark: "point" },
      ],
    });
    expect(props).toMatchObject({
      rows: ["AZ", "NY"],
      columns: ["a", "b"],
      data: [
        [1, 4],
        [2, 2],
      ],
      colorScale: {
        domain: [0, 2, 4],
        range: ["#00f", "#fff", "#f00"],
        label: "WIS",
      },
      columnAxis: "top",
      columnLabelAngle: -30,
      rowAxis: "none",
      cellRadius: 2,
      cellLabels: expect.objectContaining({ color: "white", fontSize: 9 }),
    });
    expect(warnings).toEqual([
      "`point` layers over a heatmap are not supported",
    ]);

    const bad = translate("Heatmap", {
      data: { values: scores },
      mark: "rect",
      encoding: {
        x: { field: "model", type: "nominal" },
        y: { field: "wis", type: "quantitative" },
        color: { field: "loc", type: "nominal" },
      },
    });
    expect(bad.warnings).toHaveLength(2);
  });

  it("deduplicates unsupported warnings and throws in strict mode", () => {
    const { warnings } = vegaLiteToChart(
      {
        config: { view: { stroke: null } },
        transform: [{ filter: "datum.n > 1" }],
        facet: { row: { field: "origin" } },
        layer: [
          {
            mark: { type: "line", interpolate: "basis" },
            encoding: {
              x: { field: "t", type: "quantitative", timeUnit: "month" },
              y: { field: "n", type: "quantitative", aggregate: "mean" },
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
      { data: [{ t: 1, n: 2 }] },
    );
    expect(warnings).toEqual([
      "`facet` is not supported",
      "`config` is ignored; style the chart with its props",
      "`transform` is not supported; pass rows that are ready to plot",
      "`x.timeUnit` is not applied; values are plotted as given",
      "`y.aggregate` is not applied; values are plotted as given",
      '`interpolate: "basis"` is not supported',
    ]);
    expect(() =>
      vegaLiteToChart(
        { mark: "line", transform: [{ filter: "true" }] },
        { strict: true },
      ),
    ).toThrow("Vega-Lite: `transform` is not supported");
  });
});
