import type { ChartData } from "./axes.js";

export interface CsvSeries {
  data: ChartData;
  /** Optional parallel x-values; when all series share the same x, an `x` column is used. */
  x?: ChartData;
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
  const headers =
    series.length === 1
      ? [xHeader, "value"]
      : [xHeader, ...series.map((_, i) => `series_${i}`)];
  const rows = [headers.join(",")];
  for (let r = 0; r < maxLen; r++) {
    const xCell = sharedX ? String(sharedX[r]) : r.toString();
    const cells = [xCell];
    for (const s of series) {
      cells.push(r < s.data.length ? String(s.data[r]) : "");
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

/**
 * Build a CSV for a categorical chart (BarChart vertical / horizontal):
 * one row per category, one column per series.
 */
export function categoricalToCsv(
  categories: readonly string[],
  series: { label?: string; data: ChartData }[],
  categoryHeader = "category",
): string {
  if (series.length === 0 || categories.length === 0) return "";
  const headers =
    series.length === 1
      ? [categoryHeader, series[0].label || "value"]
      : [categoryHeader, ...series.map((s, i) => s.label || `series_${i}`)];
  const rows = [headers.join(",")];
  for (let r = 0; r < categories.length; r++) {
    const cells = [escapeCsv(categories[r])];
    for (const s of series) {
      cells.push(r < s.data.length ? String(s.data[r]) : "");
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
