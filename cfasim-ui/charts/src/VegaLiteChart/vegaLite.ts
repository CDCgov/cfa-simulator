import { d3Format, d3TimeFormat } from "@cfasim-ui/shared";
import type { Area, LineChartProps, Series } from "../LineChart/LineChart.vue";
import type {
  BarChartProps,
  BarSeries,
  BarSummaryLine,
} from "../BarChart/BarChart.vue";
import { stackAreas, type StackedAreaLayer } from "../LineChart/stackAreas.js";
import {
  CATEGORICAL_COLORS,
  parseDate,
  type LineCurve,
} from "../_shared/index.js";

/** Vega-Lite's field types. */
export type VegaLiteType = "quantitative" | "temporal" | "nominal" | "ordinal";

/** One encoding channel: a data field, a constant `datum`, or a `value`. */
export interface VegaLiteFieldDef {
  field?: string;
  type?: VegaLiteType;
  datum?: unknown;
  value?: unknown;
  title?: string | null;
  stack?: "zero" | "normalize" | "center" | boolean | null;
  scale?: {
    type?: string;
    domain?: unknown[];
    range?: unknown[];
    scheme?: unknown;
    zero?: boolean;
    reverse?: boolean;
  } | null;
  axis?: {
    title?: string | null;
    format?: string;
    formatType?: string;
    grid?: boolean;
  } | null;
  legend?: { title?: string | null } | null;
  sort?: unknown;
  aggregate?: unknown;
  bin?: unknown;
  timeUnit?: unknown;
  [key: string]: unknown;
}

export type VegaLiteEncoding = Record<string, VegaLiteFieldDef | undefined>;

export interface VegaLiteMarkDef {
  type: string;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  strokeDash?: number[];
  point?: boolean | object;
  line?: boolean | object;
  interpolate?: string;
  [key: string]: unknown;
}

export interface VegaLiteData {
  values?: readonly Record<string, unknown>[];
  url?: string;
  name?: string;
  [key: string]: unknown;
}

/** A single view: a mark and its encodings, or a layer of views. */
export interface VegaLiteSpec {
  $schema?: string;
  title?: string | { text: string | string[]; subtitle?: string | string[] };
  description?: string;
  width?: number | "container";
  height?: number | "container";
  data?: VegaLiteData | null;
  mark?: string | VegaLiteMarkDef;
  encoding?: VegaLiteEncoding;
  layer?: readonly VegaLiteSpec[];
  transform?: readonly unknown[];
  params?: readonly unknown[];
  config?: unknown;
  [key: string]: unknown;
}

export interface VegaLiteOptions {
  /** Rows to plot. Wins over the spec's inline `data.values`. */
  data?: readonly Record<string, unknown>[];
  /** Throw on the first unsupported piece instead of warning about it. */
  strict?: boolean;
}

/** A cfasim chart to render, with what the spec asked for that it could not. */
export type VegaLiteChart =
  | { component: "LineChart"; props: LineChartProps; warnings: string[] }
  | { component: "BarChart"; props: BarChartProps; warnings: string[] };

type Row = Record<string, unknown>;

const CURVES: Record<string, LineCurve> = {
  linear: "linear",
  step: "step",
  "step-before": "step-before",
  "step-after": "step-after",
  monotone: "monotone",
};

/**
 * Translate a Vega-Lite spec to a cfasim `LineChart` or `BarChart`: a bar
 * mark makes a BarChart (other layers become summary lines), anything else
 * a LineChart. Every piece of the spec outside the supported subset is
 * skipped with a warning (or throws with `strict`). Data must arrive ready
 * to plot: transforms, aggregates, `bin: true` and `timeUnit` are not
 * applied.
 */
export function vegaLiteToChart(
  spec: VegaLiteSpec,
  opts: VegaLiteOptions = {},
): VegaLiteChart {
  const warnings: string[] = [];
  const warn = (msg: string) => {
    if (opts.strict) throw new Error(`Vega-Lite: ${msg}`);
    if (!warnings.includes(msg)) warnings.push(msg);
  };

  for (const key of ["facet", "repeat", "concat", "hconcat", "vconcat"]) {
    if (spec[key] !== undefined) warn(`\`${key}\` is not supported`);
  }
  if (spec.config !== undefined) {
    warn("`config` is ignored; style the chart with its props");
  }
  const units = flatten(spec, warn, opts.data !== undefined);
  const rows = (u: Unit) => opts.data ?? u.data ?? [];

  const common = {
    ...(titleOf(spec.title) !== undefined && { title: titleOf(spec.title) }),
    ...(typeof spec.width === "number" && { width: spec.width }),
    ...(typeof spec.height === "number" && { height: spec.height }),
  };
  const isBar = units.some((u) => u.mark.type === "bar");
  return isBar
    ? {
        component: "BarChart",
        props: { ...common, ...barChart(units, rows, warn) },
        warnings,
      }
    : {
        component: "LineChart",
        props: { ...common, ...lineChart(units, rows, warn) },
        warnings,
      };
}

type Warn = (msg: string) => void;

interface Unit {
  mark: VegaLiteMarkDef;
  encoding: VegaLiteEncoding;
  data?: readonly Row[];
}

/** Every leaf view, with encodings and data inherited from its layers. */
function flatten(
  spec: VegaLiteSpec,
  warn: Warn,
  supplied: boolean,
  parent: { encoding: VegaLiteEncoding; data?: readonly Row[] } = {
    encoding: {},
  },
): Unit[] {
  if (spec.transform?.length) {
    warn("`transform` is not supported; pass rows that are ready to plot");
  }
  if (spec.params?.length) warn("`params` (selections) are not supported");
  const encoding = { ...parent.encoding, ...spec.encoding };
  const data = rowsOf(spec.data, warn, supplied) ?? parent.data;
  if (spec.layer) {
    return spec.layer.flatMap((l) =>
      flatten(l, warn, supplied, { encoding, data }),
    );
  }
  if (spec.mark === undefined) return [];
  const mark = typeof spec.mark === "string" ? { type: spec.mark } : spec.mark;
  return [{ mark, encoding, data }];
}

function rowsOf(
  data: VegaLiteData | null | undefined,
  warn: Warn,
  supplied: boolean,
): readonly Row[] | undefined {
  if (!data) return undefined;
  if (data.values) return data.values;
  if (!supplied)
    warn(
      "only inline `data.values` is supported; pass rows with the `data` option",
    );
  return undefined;
}

function titleOf(title: VegaLiteSpec["title"]): string | undefined {
  if (title === undefined) return undefined;
  const text = typeof title === "string" ? title : title.text;
  return Array.isArray(text) ? text.join("\n") : text;
}

/** A row's value for `field`, following dots into nested objects. */
function get(row: Row, field: string): unknown {
  if (field in row) return row[field];
  let v: unknown = row;
  for (const part of field.split(".")) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Row)[part];
  }
  return v;
}

/** A channel's field, after warning about what the translator skips. */
function fieldOf(
  def: VegaLiteFieldDef | undefined,
  channel: string,
  warn: Warn,
): string | undefined {
  if (!def) return undefined;
  if (def.aggregate !== undefined) {
    warn(
      `\`${channel}.aggregate\` is not applied; values are plotted as given`,
    );
  }
  if (def.timeUnit !== undefined) {
    warn(`\`${channel}.timeUnit\` is not applied; values are plotted as given`);
  }
  if (def.bin !== undefined && def.bin !== "binned") {
    warn(`\`${channel}.bin\` is not applied; pass binned rows`);
  }
  if (def.scale?.reverse) warn(`\`${channel}.scale.reverse\` is not supported`);
  return def.field;
}

const num = (v: unknown) =>
  v === null || v === undefined || v === "" ? NaN : Number(v);

/** A temporal value as the charts read it: numbers are epoch ms. */
const time = (v: unknown) =>
  typeof v === "number" ? new Date(v) : (v as string | Date);

const isDiscrete = (def?: VegaLiteFieldDef) =>
  def?.type === "nominal" || def?.type === "ordinal";

/**
 * The distinct values of `field`, ordered as Vega-Lite orders a discrete
 * domain: an explicit `scale.domain` or `sort` array, by another
 * channel's per-value sum for a channel sort (`"-y"`), else ascending.
 */
function domainOf(
  rows: readonly Row[],
  field: string,
  def: VegaLiteFieldDef,
  warn: Warn,
  encoding?: VegaLiteEncoding,
): unknown[] {
  const sort = def.sort;
  const explicit = Array.isArray(def.scale?.domain)
    ? def.scale.domain
    : Array.isArray(sort)
      ? sort
      : null;
  const seen = [...new Set(rows.map((r) => get(r, field)))].filter(
    (v) => v !== undefined && v !== null,
  );
  if (explicit) {
    return [...explicit, ...seen.filter((v) => !explicit.includes(v))];
  }
  if (sort === null) return seen;
  if (
    typeof sort === "string" &&
    sort !== "ascending" &&
    sort !== "descending"
  ) {
    const desc = sort.startsWith("-");
    const by = encoding?.[desc ? sort.slice(1) : sort]?.field;
    if (by) {
      const sums = new Map<unknown, number>();
      for (const r of rows) {
        const v = num(get(r, by));
        const k = get(r, field);
        if (Number.isFinite(v)) sums.set(k, (sums.get(k) ?? 0) + v);
      }
      const total = (v: unknown) => sums.get(v) ?? 0;
      return seen.sort((a, b) =>
        desc ? total(b) - total(a) : total(a) - total(b),
      );
    }
    warn(`\`sort: "${sort}"\` is not supported`);
  } else if (sort !== undefined && typeof sort === "object") {
    warn("an object `sort` is not supported; sort by a channel or an array");
  }
  const sorted = seen.sort((a, b) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b)),
  );
  return sort === "descending" ? sorted.reverse() : sorted;
}

/** Color for each value of a discrete `color` field. */
function colorScale(
  rows: readonly Row[],
  field: string,
  def: VegaLiteFieldDef,
  warn: Warn,
): (v: unknown) => string {
  if (def.scale?.scheme !== undefined) {
    warn("`color.scale.scheme` is not supported; use `scale.range`");
  }
  const domain = domainOf(rows, field, def, warn);
  const range = Array.isArray(def.scale?.range)
    ? (def.scale.range as string[])
    : CATEGORICAL_COLORS;
  return (v) => range[Math.max(0, domain.indexOf(v)) % range.length];
}

/** Rows split by the `color` field (one group when there is none). */
function groupsOf(
  rows: readonly Row[],
  colorDef: VegaLiteFieldDef | undefined,
  warn: Warn,
): { key?: string; rows: Row[]; color?: string }[] {
  const field = fieldOf(colorDef, "color", warn);
  if (!field || !colorDef) {
    const value = colorDef?.value;
    return [
      { rows: [...rows], color: typeof value === "string" ? value : undefined },
    ];
  }
  if (!isDiscrete(colorDef)) {
    warn("a continuous `color` field is not supported");
    return [{ rows: [...rows] }];
  }
  const color = colorScale(rows, field, colorDef, warn);
  const byValue = new Map<unknown, Row[]>();
  for (const r of rows) {
    const k = get(r, field);
    const list = byValue.get(k);
    if (list) list.push(r);
    else byValue.set(k, [r]);
  }
  return domainOf(rows, field, colorDef, warn).map((v) => ({
    key: String(v),
    rows: byValue.get(v) ?? [],
    color: color(v),
  }));
}

function labelOf(def?: VegaLiteFieldDef): string | undefined {
  if (!def) return undefined;
  if (def.axis === null) return undefined;
  const t = def.axis?.title !== undefined ? def.axis.title : def.title;
  return t === null ? undefined : (t ?? def.field);
}

/** A d3 axis format for a channel, as a chart tick formatter. */
function tickFormat(def: VegaLiteFieldDef | undefined, temporal: boolean) {
  const format = def?.axis?.format;
  if (format === undefined) return undefined;
  const asTime = def?.axis?.formatType === "time" || temporal;
  if (asTime) {
    const f = d3TimeFormat(format);
    return (v: number) => f(v);
  }
  const f = d3Format(format);
  return (v: number) => f(v);
}

function curveOf(mark: VegaLiteMarkDef, warn: Warn): LineCurve | undefined {
  if (mark.interpolate === undefined) return undefined;
  const c = CURVES[mark.interpolate];
  if (!c) warn(`\`interpolate: "${mark.interpolate}"\` is not supported`);
  return c;
}

/** Positions for a line's x channel and the discrete values they index. */
interface XAxis {
  temporal: boolean;
  categories?: unknown[];
}

/** Rows sorted by a position key, as the charts read it (dates in UTC). */
function sortBy(rows: readonly Row[], key: (r: Row) => unknown): Row[] {
  const keyed = rows.map((r) => {
    const v = key(r);
    const k = typeof v === "number" ? v : (parseDate(v, "utc") ?? Number(v));
    return { r, k: Number.isFinite(k) ? k : Infinity };
  });
  return keyed.sort((a, b) => a.k - b.k).map((e) => e.r);
}

function xValue(row: Row, field: string, axis: XAxis): number | string | Date {
  const v = get(row, field);
  if (axis.categories) return axis.categories.indexOf(v);
  return axis.temporal ? time(v) : num(v);
}

function lineChart(
  units: Unit[],
  rowsFor: (u: Unit) => readonly Row[],
  warn: Warn,
): LineChartProps {
  const series: Series[] = [];
  const areas: Area[] = [];
  const first = units[0];
  const xDef = first?.encoding.x;
  const yDef = first?.encoding.y;
  const axis: XAxis = { temporal: xDef?.type === "temporal" };
  const xField = fieldOf(xDef, "x", warn);
  if (xField && isDiscrete(xDef)) {
    axis.categories = domainOf(
      units.flatMap(rowsFor),
      xField,
      xDef!,
      warn,
      first.encoding,
    );
  }

  for (const u of units) {
    const { mark, encoding } = u;
    const x = fieldOf(encoding.x, "x", warn);
    const y = fieldOf(encoding.y, "y", warn);
    if (!x || !y) {
      warn(`a \`${mark.type}\` layer needs \`x\` and \`y\` fields`);
      continue;
    }
    const kind = mark.type;
    if (
      !["line", "point", "circle", "square", "area", "trail"].includes(kind)
    ) {
      warn(`\`${kind}\` marks are not supported`);
      continue;
    }
    const curve = curveOf(mark, warn);
    // Vega-Lite drops rows whose position is missing, then sorts by x.
    const usable = rowsFor(u).filter(
      (r) => get(r, x) != null && Number.isFinite(num(get(r, y))),
    );
    const groups = groupsOf(usable, encoding.color, warn);
    const sortX = (rows: Row[]) => sortBy(rows, (r) => xValue(r, x, axis));
    const style = (g: (typeof groups)[number]) => ({
      ...((mark.color ?? g.color) !== undefined && {
        color: mark.color ?? g.color,
      }),
      ...(g.key !== undefined && { legend: g.key }),
      ...(mark.opacity !== undefined && { opacity: mark.opacity }),
    });

    if (kind === "area") {
      const y2 = fieldOf(encoding.y2, "y2", warn);
      const stack = encoding.y?.stack;
      if (!y2 && encoding.color?.field && stack !== null && stack !== false) {
        if (stack === "center") warn('`stack: "center"` is not supported');
        const layers: StackedAreaLayer[] = groups.map((g) => {
          const rows = sortX(g.rows);
          return {
            ...style(g),
            ...(curve && { curve }),
            x: rows.map((r) => xValue(r, x, axis)) as number[],
            y: rows.map((r) => num(get(r, y))),
          };
        });
        areas.push(
          ...stackAreas(layers, {
            offset: stack === "normalize" ? "normalize" : "zero",
          }),
        );
        continue;
      }
      for (const g of groups) {
        const rows = sortX(g.rows);
        const a = rows.map((r) => num(get(r, y)));
        const b = rows.map((r) => (y2 ? num(get(r, y2)) : 0));
        areas.push({
          ...style(g),
          ...(curve && { curve }),
          x: rows.map((r) => xValue(r, x, axis)) as number[],
          // Either of y / y2 can be the band's top.
          upper: a.map((v, i) => Math.max(v, b[i])),
          lower: a.map((v, i) => Math.min(v, b[i])),
        });
      }
      continue;
    }

    const isLine = kind === "line" || kind === "trail";
    for (const g of groups) {
      const rows = sortX(g.rows);
      series.push({
        ...style(g),
        ...(curve && { curve }),
        x: rows.map((r) => xValue(r, x, axis)) as number[],
        y: rows.map((r) => num(get(r, y))),
        ...(!isLine && { line: false }),
        ...((!isLine || mark.point) && { dots: true }),
        ...(mark.strokeWidth !== undefined && {
          strokeWidth: mark.strokeWidth,
        }),
        ...(mark.strokeDash?.length && { dashed: true }),
      });
    }
  }

  const props: LineChartProps = { series, ...(areas.length && { areas }) };
  const xLabel = labelOf(xDef);
  const yLabel = labelOf(yDef);
  if (xLabel !== undefined) props.xLabel = xLabel;
  if (yLabel !== undefined) props.yLabel = yLabel;
  if (axis.categories) {
    const cats = axis.categories;
    props.xTicks = cats.map((_, i) => i);
    props.xTickFormat = (v: number) => String(cats[v] ?? "");
  } else {
    const fmt = tickFormat(xDef, axis.temporal);
    if (fmt) props.xTickFormat = fmt;
  }
  const yFmt = tickFormat(yDef, false);
  if (yFmt) props.yTickFormat = yFmt;
  if (xDef?.axis?.grid) props.xGrid = true;
  if (yDef?.axis?.grid) props.yGrid = true;
  if (yDef?.scale?.type === "log") props.yScaleType = "log";
  else if (yDef?.scale?.type && yDef.scale.type !== "linear") {
    warn(`\`y.scale.type: "${yDef.scale.type}"\` is not supported`);
  }
  const [lo, hi] = numericDomain(yDef);
  if (lo !== undefined) props.yMin = lo;
  if (hi !== undefined) props.yMax = hi;
  if (xDef?.scale?.domain) warn("`x.scale.domain` is not supported");
  return props;
}

function numericDomain(
  def: VegaLiteFieldDef | undefined,
): [number | undefined, number | undefined] {
  const d = def?.scale?.domain;
  if (!Array.isArray(d) || d.length !== 2) return [undefined, undefined];
  const lo = Number(d[0]);
  const hi = Number(d[1]);
  return [
    Number.isFinite(lo) ? lo : undefined,
    Number.isFinite(hi) ? hi : undefined,
  ];
}

function barChart(
  units: Unit[],
  rowsFor: (u: Unit) => readonly Row[],
  warn: Warn,
): BarChartProps {
  const bar = units.find((u) => u.mark.type === "bar")!;
  const enc = bar.encoding;
  // Vega-Lite lays bars along the quantitative channel.
  const horizontal =
    enc.x?.type === "quantitative" && enc.y?.type !== "quantitative";
  const catDef = horizontal ? enc.y : enc.x;
  const valDef = horizontal ? enc.x : enc.y;
  const cat = fieldOf(catDef, horizontal ? "y" : "x", warn);
  const val = fieldOf(valDef, horizontal ? "x" : "y", warn);
  const props: BarChartProps = {};
  if (!cat || !val || !catDef || !valDef) {
    warn("a `bar` layer needs `x` and `y` fields");
    return props;
  }
  if (horizontal) props.orientation = "horizontal";

  const rows = rowsFor(bar).filter((r) => get(r, cat) != null);
  const discrete = isDiscrete(catDef);
  const temporal = catDef.type === "temporal";
  const categories = discrete
    ? domainOf(rows, cat, catDef, warn, enc)
    : undefined;
  const stack = valDef.stack;
  const offset = horizontal ? enc.yOffset : enc.xOffset;
  // An offset field groups bars side by side even without a color field.
  const groups = groupsOf(
    rows,
    !enc.color?.field && offset?.field ? offset : enc.color,
    warn,
  );

  const values = (g: Row[]) => {
    if (!categories) return g.map((r) => num(get(r, val)));
    const byCat = new Map<unknown, number>();
    for (const r of g) {
      const c = get(r, cat);
      if (byCat.has(c)) {
        warn("several rows share a bar; the first one is plotted");
      } else byCat.set(c, num(get(r, val)));
    }
    return categories.map((c) => byCat.get(c) ?? NaN);
  };
  let series: BarSeries[] = groups.map((g) => ({
    data: values(g.rows),
    ...(!categories && {
      x: g.rows.map((r) => (temporal ? time(get(r, cat)) : num(get(r, cat)))),
    }),
    ...((bar.mark.color ?? g.color) !== undefined && {
      color: bar.mark.color ?? g.color,
    }),
    ...(g.key !== undefined && { legend: g.key }),
    ...(bar.mark.opacity !== undefined && { opacity: bar.mark.opacity }),
  })) as BarSeries[];

  if (groups.length > 1) {
    if (offset?.field) props.layout = "grouped";
    else if (stack === null || stack === false) props.layout = "overlay";
    else {
      props.layout = "stacked";
      if (stack === "normalize") {
        if (categories) series = normalize(series, categories);
        else warn('`stack: "normalize"` needs a discrete bar axis');
      } else if (stack === "center") warn('`stack: "center"` is not supported');
    }
  }
  props.series = series;
  if (categories) {
    props.categories = categories.map(String);
    // A discrete field shows its values as written, even date-like ones
    // BarChart would otherwise reformat as dates.
    props.categoryFormat = (label) => label;
  }

  const summaryLines: BarSummaryLine[] = [];
  for (const u of units) {
    if (u === bar) continue;
    const kind = u.mark.type;
    if (kind === "bar") {
      warn("only one `bar` layer is supported");
      continue;
    }
    if (!["line", "point", "circle", "square"].includes(kind)) {
      warn(`\`${kind}\` layers over bars are not supported`);
      continue;
    }
    const c = fieldOf(horizontal ? u.encoding.y : u.encoding.x, "x", warn);
    const v = fieldOf(horizontal ? u.encoding.x : u.encoding.y, "y", warn);
    if (!c || !v) continue;
    const curve = curveOf(u.mark, warn);
    const position = (r: Row) => {
      const p = get(r, c);
      if (categories) return categories.indexOf(p);
      return temporal ? time(p) : num(p);
    };
    for (const g of groupsOf(rowsFor(u), u.encoding.color, warn)) {
      // On the bars' axis, in axis order; rows off it are dropped.
      const pts = sortBy(
        g.rows.filter(
          (r) =>
            Number.isFinite(num(get(r, v))) &&
            get(r, c) != null &&
            (!categories || categories.includes(get(r, c))),
        ),
        position,
      );
      const isLine = kind === "line";
      summaryLines.push({
        data: pts.map((r) => num(get(r, v))),
        x: pts.map(position) as number[],
        scale: "shared",
        ...((u.mark.color ?? g.color) !== undefined && {
          color: u.mark.color ?? g.color,
        }),
        ...(g.key !== undefined && { legend: g.key }),
        ...(curve && { curve }),
        // A point layer has no line: a zero-width stroke with dots.
        ...(isLine
          ? u.mark.point && { dots: true }
          : { dots: true, strokeWidth: 0, dotRadius: 3 }),
      });
    }
  }
  if (summaryLines.length) props.summaryLines = summaryLines;

  const xLabel = labelOf(enc.x);
  const yLabel = labelOf(enc.y);
  if (xLabel !== undefined) props.xLabel = xLabel;
  if (yLabel !== undefined) props.yLabel = yLabel;
  const valFmt = tickFormat(valDef, false);
  if (valFmt) props.valueTickFormat = valFmt;
  if (!categories) {
    const xFmt = tickFormat(catDef, temporal);
    if (xFmt) props.xTickFormat = xFmt;
  }
  if (valDef.axis === null) props.valueAxis = false;
  if (valDef.axis?.grid === false) props.valueGrid = false;
  if (valDef.scale?.type === "log") props.valueScaleType = "log";
  else if (valDef.scale?.type && valDef.scale.type !== "linear") {
    warn(`\`scale.type: "${valDef.scale.type}"\` is not supported on bars`);
  }
  const [lo, hi] = numericDomain(valDef);
  if (lo !== undefined) props.valueMin = lo;
  if (hi !== undefined) props.valueMax = hi;
  return props;
}

/** Each category's segments as shares of its total, for `stack: "normalize"`. */
function normalize(series: BarSeries[], categories: unknown[]): BarSeries[] {
  const totals = categories.map((_, i) =>
    series.reduce((sum, s) => {
      const v = Number(s.data![i]);
      return Number.isFinite(v) ? sum + Math.abs(v) : sum;
    }, 0),
  );
  return series.map((s) => ({
    ...s,
    data: categories.map((_, i) => {
      const v = Number(s.data![i]);
      return totals[i] ? Math.abs(v) / totals[i] : NaN;
    }),
  }));
}
