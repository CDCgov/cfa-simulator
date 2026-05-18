<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import {
  formatNumber,
  type ModelOutput,
  type NumberFormat,
} from "@cfasim-ui/shared";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { downloadCsv } from "../ChartMenu/download.js";

export type TableRecord = Record<string, ArrayLike<number | string | boolean>>;
export type TableData = TableRecord | ModelOutput;
export type ColumnWidth = "small" | "medium" | "large";
export type ColumnAlign = "left" | "center" | "right";
export type CellValue = number | string | boolean;
export type ColumnFormatter = (value: CellValue, row: number) => string;

export interface ColumnConfig {
  label?: string;
  width?: ColumnWidth | number;
  align?: ColumnAlign;
  cellClass?: string;
  /**
   * Custom formatter for cell values in this column. Accepts a
   * {@link NumberFormat} (preset name, printf-style string, or
   * `(value) => string` function — see `formatNumber` in
   * `@cfasim-ui/shared`) or a `(value, row) => string` function for full
   * control. Number presets/sprintf only apply to numeric cells; other
   * types fall back to default rendering. Used in CSV exports.
   */
  format?: NumberFormat | ColumnFormatter;
}

const COLUMN_WIDTHS: Record<ColumnWidth, string> = {
  small: "80px",
  medium: "150px",
  large: "250px",
};

const props = withDefaults(
  defineProps<{
    data: TableData;
    maxRows?: number;
    columnConfig?: Record<string, ColumnConfig>;
    menu?: boolean | string;
    /**
     * Custom CSV content for the Download menu item. Can be a raw CSV string
     * or a function returning one. When omitted, CSV is generated from the
     * table data.
     */
    csv?: string | (() => string);
    /** Filename (without extension) for downloaded CSV files. */
    filename?: string;
    /**
     * Label for the Download item in the table's top-right menu.
     * Defaults to "Download".
     */
    downloadMenuLink?: string;
    /** Stretch the table to fill its container's width. */
    fullWidth?: boolean;
  }>(),
  { menu: true, fullWidth: false, downloadMenuLink: "Download" },
);

function columnLabel(name: string): string {
  return props.columnConfig?.[name]?.label ?? name;
}

function columnStyle(name: string): Record<string, string> | undefined {
  const w = props.columnConfig?.[name]?.width;
  if (w == null) {
    if (props.fullWidth) return undefined;
    return { width: COLUMN_WIDTHS.medium, minWidth: COLUMN_WIDTHS.medium };
  }
  const value = typeof w === "number" ? `${w}px` : COLUMN_WIDTHS[w];
  return { width: value, minWidth: value };
}

function columnAlignStyle(name: string): CSSProperties | undefined {
  const align = props.columnConfig?.[name]?.align;
  if (!align) return undefined;
  return { textAlign: align };
}

function isModelOutput(d: TableData): d is ModelOutput {
  return typeof (d as ModelOutput).column === "function";
}

interface Column {
  name: string;
  values: ArrayLike<number | string | boolean>;
  enumLabels?: string[];
}

const columns = computed<Column[]>(() => {
  const d = props.data;
  if (isModelOutput(d)) {
    return d.columns.map((col) => ({
      name: col.name,
      values: d.column(col.name),
      enumLabels: col.enumLabels,
    }));
  }
  return Object.entries(d).map(([name, values]) => ({ name, values }));
});

const rowCount = computed(() => {
  const cols = columns.value;
  if (cols.length === 0) return 0;
  let max = 0;
  for (const col of cols) max = Math.max(max, col.values.length);
  return props.maxRows ? Math.min(max, props.maxRows) : max;
});

function cellValue(col: Column, row: number): string {
  const v = col.values[row];
  if (v === undefined || v === null) return "";
  const format = props.columnConfig?.[col.name]?.format;
  if (format !== undefined) {
    // Function variant — either `(value: number) => string` (NumberFormat
    // function) or `(value, row) => string` (ColumnFormatter). Both call
    // sites are compatible; the narrower variant ignores `row`.
    if (typeof format === "function") {
      return (format as ColumnFormatter)(v, row);
    }
    // String preset/sprintf — only applies to numeric cells; other types
    // fall through to default rendering.
    if (typeof v === "number") return formatNumber(v, format);
  }
  if (col.enumLabels && typeof v === "number")
    return col.enumLabels[v] ?? String(v);
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(4);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function menuFilename() {
  if (props.filename) return props.filename;
  return typeof props.menu === "string" ? props.menu : "data";
}

function escapeCsvField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function toCsv(): string {
  if (typeof props.csv === "function") return props.csv();
  if (typeof props.csv === "string") return props.csv;
  const cols = columns.value;
  const rows = rowCount.value;
  const headers = cols.map((c) => escapeCsvField(columnLabel(c.name)));
  const lines = [headers.join(",")];
  for (let r = 0; r < rows; r++) {
    const cells = cols.map((c) => escapeCsvField(cellValue(c, r)));
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

const menuItems = computed<ChartMenuItem[]>(() => [
  {
    label: props.downloadMenuLink,
    action: () => downloadCsv(toCsv(), menuFilename()),
  },
]);

const showMenu = computed(() => Boolean(props.menu));
</script>

<template>
  <div
    class="TableOuter"
    :class="{ 'full-width': fullWidth, 'has-menu': showMenu }"
  >
    <ChartMenu v-if="showMenu" :items="menuItems" force-dropdown />
    <div class="TableWrapper">
      <table class="Table" :class="{ 'full-width': fullWidth }">
        <colgroup>
          <col
            v-for="col in columns"
            :key="col.name"
            :style="columnStyle(col.name)"
          />
        </colgroup>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.name"
              :style="columnAlignStyle(col.name)"
            >
              {{ columnLabel(col.name) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rowCount" :key="row">
            <td
              v-for="col in columns"
              :key="col.name"
              :class="columnConfig?.[col.name]?.cellClass"
              :style="columnAlignStyle(col.name)"
            >
              {{ cellValue(col, row - 1) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.TableOuter {
  position: relative;
  display: inline-block;
}

.TableOuter.full-width {
  display: block;
}

.TableWrapper {
  overflow-x: auto;
  font-size: var(--font-size-sm);
}

.Table {
  display: table;
  margin: 0;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--color-border);
  table-layout: fixed;
}

.Table.full-width {
  width: 100%;
}

.Table tr,
.Table th,
.Table td {
  background: transparent;
  border: none;
}

.Table th,
.Table td {
  padding: 0.75em 1.25em;
  white-space: nowrap;
  text-align: left;
}

.Table th {
  font-weight: 600;
  border-bottom: 1px solid var(--color-border-header);
  position: sticky;
  top: 0;
}

.Table tbody td {
  border-bottom: 1px solid var(--color-border);
}

.Table tbody tr:last-child td {
  border-bottom: none;
}

.TableOuter :deep(.chart-menu-trigger-area) {
  top: 4px;
  right: 4px;
}

.TableOuter :deep(.chart-menu-button) {
  opacity: 1;
}

.TableOuter.has-menu .Table thead th:last-child {
  padding-right: 2.5em;
}
</style>
