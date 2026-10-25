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
  parseRgb,
  type Rgb,
  type ChartAnnotation,
  type ChartInterval,
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
  /** Encodings with the ones inherited from enclosing layers. */
  encoding: VegaLiteEncoding;
  /** The encodings this view sets itself. */
  own: VegaLiteEncoding;
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
  return [{ mark, encoding, own: spec.encoding ?? {}, data }];
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
  const marked = units.filter((u) => !DECORATIONS.has(u.mark.type));
  const xUnit = marked.find((u) => u.encoding.x?.field) ?? units[0];
  const xDef = xUnit?.encoding.x;
  const yDef = (marked.find((u) => u.encoding.y?.field) ?? units[0])?.encoding
    .y;
  const axis: XAxis = { temporal: xDef?.type === "temporal" };
  const xField = fieldOf(xDef, "x", warn);
  if (xField && isDiscrete(xDef)) {
    axis.categories = domainOf(
      units.flatMap(rowsFor),
      xField,
      xDef!,
      warn,
      xUnit.encoding,
    );
  }
  const deco = decorations();
  const pos = (v: unknown) =>
    axis.categories ? indexIn(axis.categories, v) : position(v, axis.temporal);

  for (const u of units) {
    const { mark, encoding } = u;
    if (DECORATIONS.has(mark.type)) {
      decorate(u, rowsFor(u), "x", "y", pos, deco, warn);
      continue;
    }
    const x = fieldOf(encoding.x, "x", warn);
    const y = fieldOf(encoding.y, "y", warn);
    if (!x || !y) {
      warn(`a \`${mark.type}\` layer needs \`x\` and \`y\` fields`);
      continue;
    }
    const kind = mark.type === "errorband" ? "area" : mark.type;
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
    const pointMark = POINT_MARKS.has(kind);
    const shaded = pointMark && encoding.color?.type === "quantitative";
    const groups = groupsOf(usable, shaded ? undefined : encoding.color, warn);
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
      if (mark.type === "errorband" && !y2) {
        warn(
          "an `errorband` needs `y` and `y2` fields (bounds, not raw values)",
        );
        continue;
      }
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
    const dashed =
      !!mark.strokeDash?.length ||
      (Array.isArray(encoding.strokeDash?.value) &&
        encoding.strokeDash.value.length > 0);
    if (encoding.strokeDash?.field) {
      warn("a `strokeDash` field is not supported; split series by `color`");
    }
    for (const g of groups) {
      const rows = sortX(g.rows);
      const s: Series = {
        ...style(g),
        ...(curve && { curve }),
        x: rows.map((r) => xValue(r, x, axis)) as number[],
        y: rows.map((r) => num(get(r, y))),
        ...(!isLine && { line: false }),
        ...((!isLine || mark.point) && { dots: true }),
        ...(mark.strokeWidth !== undefined && {
          strokeWidth: mark.strokeWidth,
        }),
        ...(dashed && { dashed: true }),
      };
      if (pointMark) pointStyle(s, rows, u, warn);
      series.push(s);
    }
  }

  // Horizontal rules must stay on the axis, which annotations do not widen.
  const props: LineChartProps = { series, ...(areas.length && { areas }) };
  const firstX = series[0]?.x?.[0] ?? areas[0]?.x?.[0];
  anchorRules(
    deco,
    position(firstX, axis.temporal && !axis.categories),
    series[0]?.y?.[0] ?? areas[0]?.upper[0],
  );
  if (deco.annotations.length) props.annotations = deco.annotations;
  if (deco.intervals.length) props.intervals = deco.intervals;
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
  // An explicit domain wins; otherwise the axis reaches rules and labels.
  const [lo, hi] = numericDomain(yDef);
  const yMin = lo ?? (deco.lo <= deco.hi ? deco.lo : undefined);
  const yMax = hi ?? (deco.lo <= deco.hi ? deco.hi : undefined);
  if (yMin !== undefined) props.yMin = yMin;
  if (yMax !== undefined) props.yMax = yMax;
  if (xDef?.scale?.domain) warn("`x.scale.domain` is not supported");
  return props;
}

/** Marks drawn as annotations and intervals rather than series. */
const DECORATIONS = new Set(["rule", "errorbar", "text"]);
const POINT_MARKS = new Set(["point", "circle", "square"]);

interface Decorations {
  annotations: ChartAnnotation[];
  intervals: ChartInterval[];
  /** Value range of horizontal rules and labels, for the value axis. */
  lo: number;
  hi: number;
}

function decorations(): Decorations {
  return { annotations: [], intervals: [], lo: Infinity, hi: -Infinity };
}

function include(out: Decorations, v: number) {
  if (v < out.lo) out.lo = v;
  if (v > out.hi) out.hi = v;
}

/** A value's index on a discrete axis; NaN when it is not on it. */
function indexIn(categories: unknown[], v: unknown): number {
  const i = categories.indexOf(v);
  return i < 0 ? NaN : i;
}

/** A non-discrete position as a chart number: epoch ms for dates. */
function position(v: unknown, temporal: boolean): number {
  if (!temporal) return num(v);
  return typeof v === "number" ? v : (parseDate(v, "utc") ?? NaN);
}

/**
 * Rules, error bars and text along `cat` (the x or category axis) and
 * `val` (the value axis): full-span rules and text become annotations,
 * spans from `val` to `val2` become intervals.
 */
function decorate(
  u: Unit,
  rows: readonly Row[],
  cat: "x" | "y",
  val: "x" | "y",
  pos: (v: unknown) => number,
  out: Decorations,
  warn: Warn,
) {
  const e = u.encoding;
  const kind = u.mark.type;
  const colorValue = e.color?.value;
  const color =
    u.mark.color ?? (typeof colorValue === "string" ? colorValue : undefined);
  if (e.color?.field) {
    warn(`a \`color\` field on \`${kind}\` marks is not supported`);
  }
  const cf = fieldOf(e[cat], cat, warn);
  const vf = fieldOf(e[val], val, warn);
  const v2f = fieldOf(e[`${val}2`], `${val}2`, warn);
  const at = (r: Row, def: VegaLiteFieldDef | undefined, f?: string) =>
    f ? get(r, f) : def?.datum;
  const hasC = !!cf || e[cat]?.datum !== undefined;
  const hasV = !!vf || e[val]?.datum !== undefined;
  // A rule from constants alone is one rule, not one per row.
  const list = cf || vf || v2f ? rows : [{}];
  const style = color !== undefined ? { color } : {};

  if (kind === "errorbar" || (kind === "rule" && v2f)) {
    if (!cf || !vf || !v2f) {
      warn(
        `an \`${kind}\` needs \`${cat}\`, \`${val}\` and \`${val}2\` fields`,
      );
      return;
    }
    for (const r of list) {
      const a = num(get(r, vf));
      const b = num(get(r, v2f));
      const x = pos(get(r, cf));
      if (![a, b, x].every(Number.isFinite)) continue;
      out.intervals.push({
        x,
        lower: Math.min(a, b),
        upper: Math.max(a, b),
        ...style,
        // A rule is a plain segment; an error bar keeps its caps.
        ...(kind === "rule" && { capWidth: 0 }),
      });
    }
    return;
  }
  if (kind === "text") {
    const t = e.text;
    if (!hasC || !hasV || (!t?.field && t?.value === undefined)) {
      warn(`a \`text\` mark needs \`${cat}\`, \`${val}\` and \`text\``);
      return;
    }
    for (const r of list) {
      const x = pos(at(r, e[cat], cf));
      const y = num(at(r, e[val], vf));
      const text = t.field ? get(r, t.field) : t.value;
      if (!Number.isFinite(x) || !Number.isFinite(y) || text == null) continue;
      include(out, y);
      out.annotations.push({
        x,
        y,
        text: String(text),
        offset: { x: 0, y: 0 },
        pointer: "none",
        align: "center",
        ...style,
      });
    }
    return;
  }
  // A rule across the plot at a value, or up the plot at a position. A
  // channel the rule sets itself wins over one it inherits for the other
  // axis (a threshold layer under a shared `x` field).
  const ownC = u.own[cat] !== undefined;
  const ownV = u.own[val] !== undefined;
  const across = hasV && (!hasC || (ownV && !ownC));
  const up = hasC && (!hasV || (ownC && !ownV));
  if (across === up) {
    warn(
      `a \`rule\` needs exactly one of \`${cat}\` / \`${val}\`, or \`${val}2\``,
    );
    return;
  }
  const seen = new Set<number>();
  for (const r of across && !vf ? [{}] : up && !cf ? [{}] : list) {
    const v = across ? num(at(r, e[val], vf)) : pos(at(r, e[cat], cf));
    // One rule per distinct position, however many rows repeat it.
    if (!Number.isFinite(v) || seen.has(v)) continue;
    seen.add(v);
    if (across) include(out, v);
    out.annotations.push({
      x: across ? NaN : v,
      y: across ? v : NaN,
      text: "",
      offset: { x: 0, y: 0 },
      pointer: across ? "ruleY" : "ruleX",
      lineColor: color ?? "currentColor",
      lineWidth: u.mark.strokeWidth ?? 1,
      ...(u.mark.strokeDash?.length && { lineDash: u.mark.strokeDash }),
    });
  }
}

/**
 * Give full-span rules the other coordinate the chart needs to place them
 * (any point on the plot will do): the first data point.
 */
function anchorRules(deco: Decorations, x: number, y: unknown) {
  const ax = x;
  const ay = Number(y);
  for (const a of deco.annotations) {
    if (Number.isNaN(a.x)) a.x = Number.isFinite(ax) ? ax : 0;
    if (Number.isNaN(a.y)) a.y = Number.isFinite(ay) ? ay : 0;
  }
}

/** Vega-Lite's default point size, an area in px². */
const POINT_SIZE = 30;

/** Point mark fill, size, opacity and color channels on a series' dots. */
function pointStyle(s: Series, rows: Row[], u: Unit, warn: Warn) {
  const { mark, encoding: e } = u;
  const radius = (area: number) => Math.sqrt(area / Math.PI);
  const size = e.size;
  if (size?.field) {
    const [lo, hi] = rangeOf(size, [9, 361]);
    const scale = linear(rows, size.field, lo, hi, size.scale?.zero ?? true);
    s.dotRadius = rows.map((r) => finiteOr(radius(scale(r)))) as number[];
  } else {
    const area = typeof size?.value === "number" ? size.value : mark.size;
    s.dotRadius = radius(typeof area === "number" ? area : POINT_SIZE);
  }
  const opacity = e.opacity;
  if (opacity?.field) {
    const [lo, hi] = rangeOf(opacity, [0.3, 0.8]);
    const scale = linear(rows, opacity.field, lo, hi, false);
    s.dotOpacity = rows.map((r) => finiteOr(scale(r))) as number[];
  } else if (typeof opacity?.value === "number") {
    s.dotOpacity = opacity.value;
  }
  const color = e.color;
  if (color?.field && color.type === "quantitative") {
    const range = Array.isArray(color.scale?.range)
      ? color.scale.range
      : ["#deebf7", "#08519c"];
    const [c0, c1] = range.map((c) => parseRgb(String(c)));
    if (range.length !== 2 || !c0 || !c1) {
      warn("a continuous `color` needs a two-color `scale.range`");
    } else {
      const t = linear(rows, color.field, 0, 1, false);
      // A missing value leaves its dot the series' default fill.
      s.dotFill = rows.map((r) => mixRgb(c0, c1, t(r))) as string[];
      return;
    }
  }
  // Vega-Lite draws `point` marks as outlines unless `filled`.
  if (mark.type === "point" && mark.filled !== true) {
    s.dotStroke = s.color ?? "currentColor";
    s.dotFill = "none";
  }
}

/** A per-point value, or undefined so the dot falls back to its default. */
const finiteOr = (v: number) => (Number.isFinite(v) ? v : undefined);

/** A channel's `[min, max]` output range, or the default. */
function rangeOf(def: VegaLiteFieldDef, fallback: [number, number]) {
  const r = def.scale?.range;
  return Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)
    ? (r as [number, number])
    : fallback;
}

/** A linear scale from a field's extent (from 0 with `zero`) to `[lo, hi]`. */
function linear(
  rows: Row[],
  field: string,
  lo: number,
  hi: number,
  zero: boolean,
): (r: Row) => number {
  let min = zero ? 0 : Infinity;
  let max = zero ? 0 : -Infinity;
  for (const r of rows) {
    const v = num(get(r, field));
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  return (r) => {
    const v = num(get(r, field));
    if (!Number.isFinite(v)) return NaN;
    return span > 0 ? lo + ((v - min) / span) * (hi - lo) : (lo + hi) / 2;
  };
}

function mixRgb(a: Rgb, b: Rgb, t: number): string | undefined {
  if (!Number.isFinite(t)) return undefined;
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c.join(", ")})`;
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
  const cat2 = fieldOf(
    horizontal ? enc.y2 : enc.x2,
    horizontal ? "y2" : "x2",
    warn,
  );
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
    ? withLayerValues(
        domainOf(rows, cat, catDef, warn, enc),
        units,
        rowsFor,
        horizontal ? "y" : "x",
      )
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
    // Pre-binned bars (`bin: "binned"`) span x to x2.
    ...(!categories &&
      cat2 && {
        x2: g.rows.map((r) =>
          temporal ? time(get(r, cat2)) : num(get(r, cat2)),
        ),
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
  const deco = decorations();
  const pos = (v: unknown) =>
    categories ? indexIn(categories, v) : position(v, temporal);
  for (const u of units) {
    if (u === bar) continue;
    const kind = u.mark.type;
    if (DECORATIONS.has(kind)) {
      // Annotations do not turn with a horizontal chart; intervals do.
      if (horizontal && kind !== "errorbar" && !u.encoding.x2?.field) {
        warn(`\`${kind}\` layers over horizontal bars are not supported`);
      } else {
        const [c, v] = horizontal
          ? (["y", "x"] as const)
          : (["x", "y"] as const);
        decorate(u, rowsFor(u), c, v, pos, deco, warn);
      }
      continue;
    }
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
    const at = (r: Row) => pos(get(r, c));
    for (const g of groupsOf(rowsFor(u), u.encoding.color, warn)) {
      // On the bars' axis, in axis order; rows off it are dropped.
      const pts = sortBy(
        g.rows.filter(
          (r) => Number.isFinite(num(get(r, v))) && Number.isFinite(at(r)),
        ),
        at,
      );
      const isLine = kind === "line";
      summaryLines.push({
        data: pts.map((r) => num(get(r, v))),
        x: pts.map(at),
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
  anchorRules(
    deco,
    categories ? 0 : pos(get(rows[0] ?? {}, cat)),
    series[0]?.data?.[0],
  );
  if (deco.annotations.length) props.annotations = deco.annotations;
  if (deco.intervals.length) props.intervals = deco.intervals;
  const [lo, hi] = numericDomain(valDef);
  if (lo !== undefined) props.valueMin = lo;
  // An explicit domain wins; otherwise the axis reaches rules and labels
  // above the bars (valueMin is also the bar baseline, so not below them).
  const top = hi ?? (deco.lo <= deco.hi ? deco.hi : undefined);
  if (top !== undefined) props.valueMax = top;
  return props;
}

/**
 * A discrete bar axis: the bar layer's ordered values, then any other
 * layer's values for the same channel, so every layer's rows land on it
 * (Vega-Lite unions the domain across layers).
 */
function withLayerValues(
  domain: unknown[],
  units: Unit[],
  rowsFor: (u: Unit) => readonly Row[],
  channel: "x" | "y",
): unknown[] {
  const out = [...domain];
  const seen = new Set(domain);
  for (const u of units) {
    const f = u.encoding[channel]?.field;
    if (!f) continue;
    for (const r of rowsFor(u)) {
      const v = get(r, f);
      if (v != null && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
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
