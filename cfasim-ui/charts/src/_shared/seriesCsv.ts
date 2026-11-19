import type { ChartData } from "./axes.js";

/**
 * Resolve the `csv` prop override shared by the chart components: a
 * function is called, a string passes through, anything else returns
 * null so the chart falls back to generating CSV from its series.
 */
export function resolveCsvOverride(
  csv: string | (() => string) | undefined,
): string | null {
  if (typeof csv === "function") return csv();
  return typeof csv === "string" ? csv : null;
}

export interface CsvSeries {
  data: ChartData;
  /** Column header for this series. Falls back to `value` / `series_N`. */
  label?: string;
  /** Optional parallel x-values; when all series share the same x, an `x` column is used. */
  x?: ChartData;
  /** Optional interval bounds; together they add `_lower` / `_upper` columns after the value. */
  lower?: ChartData;
  upper?: ChartData;
}

type HeaderSeries = { label?: string; lower?: ChartData; upper?: ChartData };

/** Column names for one series: its value plus any interval bounds. */
function columnNames(name: string, s: HeaderSeries): string[] {
  // Both bounds or nothing, matching when a chart draws a whisker.
  return hasBounds(s) ? [name, `${name}_lower`, `${name}_upper`] : [name];
}

/**
 * Escaped headers for the series columns. A blank label falls back to
 * `value` / `series_N`, and a name already used by an earlier column (one of
 * `leadingHeaders` or another series) gets a `_2`, `_3`, ... suffix.
 */
function seriesHeaders(
  series: readonly HeaderSeries[],
  leadingHeaders: readonly string[],
): string[] {
  const used = new Set(leadingHeaders);
  const headers: string[] = [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const fallback = series.length === 1 ? "value" : `series_${i}`;
    const base = s.label?.trim() || fallback;
    let columns = columnNames(base, s);
    let copy = 2;
    while (columns.some((column) => used.has(column))) {
      columns = columnNames(`${base}_${copy}`, s);
      copy++;
    }
    for (const column of columns) {
      used.add(column);
      headers.push(escapeCsvField(column));
    }
  }
  return headers;
}

function hasBounds(s: { lower?: ChartData; upper?: ChartData }): boolean {
  return s.lower !== undefined && s.upper !== undefined;
}

function cellAt(data: ChartData | undefined, r: number): string {
  return data && r < data.length ? String(data[r]) : "";
}

/**
 * Build a CSV string for one or more numeric series. When every series
 * shares the same `x` reference an `x` column is emitted; otherwise
 * rows are indexed.
 */
export function seriesToCsv(series: CsvSeries[]): string {
  if (series.length === 0) return "";
  let maxLen = 0;
  for (const s of series) if (s.data.length > maxLen) maxLen = s.data.length;
  const sharedX = series.every((s) => s.x === series[0].x)
    ? series[0].x
    : undefined;
  const xHeader = sharedX ? "x" : "index";
  const headers = [xHeader, ...seriesHeaders(series, [xHeader])];
  const rows = [headers.join(",")];
  for (let r = 0; r < maxLen; r++) {
    const xCell = sharedX ? String(sharedX[r]) : r.toString();
    const cells = [xCell];
    for (const s of series) {
      cells.push(cellAt(s.data, r));
      if (hasBounds(s)) cells.push(cellAt(s.lower, r), cellAt(s.upper, r));
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

/**
 * Build a CSV for a categorical chart (BarChart vertical / horizontal):
 * one row per category, one column per series. `extraColumns` go right
 * after the category column (BarChart's `x_end` on a continuous axis).
 */
export function categoricalToCsv(
  categories: readonly string[],
  series: {
    label?: string;
    data: ChartData;
    lower?: ChartData;
    upper?: ChartData;
  }[],
  categoryHeader = "category",
  extraColumns: readonly { header: string; values: readonly string[] }[] = [],
): string {
  if (series.length === 0 || categories.length === 0) return "";
  const leadingHeaders = [categoryHeader, ...extraColumns.map((c) => c.header)];
  const headers = [
    ...leadingHeaders.map(escapeCsvField),
    ...seriesHeaders(series, leadingHeaders),
  ];
  const rows = [headers.join(",")];
  for (let r = 0; r < categories.length; r++) {
    const cells = [
      escapeCsvField(categories[r]),
      ...extraColumns.map((c) => escapeCsvField(c.values[r] ?? "")),
    ];
    for (const s of series) {
      cells.push(cellAt(s.data, r));
      if (hasBounds(s)) cells.push(cellAt(s.lower, r), cellAt(s.upper, r));
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
