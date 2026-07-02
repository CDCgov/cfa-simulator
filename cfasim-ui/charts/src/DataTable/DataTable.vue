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
import { escapeCsvField } from "../_shared/seriesCsv.js";

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
  /** Class applied to every body `<td>` in this column. */
  cellClass?: string;
  /**
   * Class applied to both the header `<th>` and every body `<td>` in
   * this column. Use for styling that should span the whole column
   * (borders, backgrounds, fonts). For body-only styling, use
   * `cellClass`.
   */
  columnClass?: string;
  /**
   * Allow cell contents to wrap to multiple lines when wider than the
   * column. Default `false` — cells stay on one line and truncate with
   * an ellipsis. Set to `true` for text-heavy columns where the full
   * value should remain visible.
   */
  wrap?: boolean;
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
     * Label for the Download item in the table's top-right menu, and for
     * the button rendered when `downloadButton` is true. Defaults to
     * "Download".
     */
    downloadMenuLink?: string;
    /**
     * Render a visible "Download" button beneath the table instead of
     * exposing the action only via the top-right menu. When enabled, the
     * menu's Download item is suppressed to avoid duplicate controls.
     */
    downloadButton?: boolean;
    /**
     * Render a plain text link beneath the table for downloading CSV.
     * Pass `true` for the default "Download data (CSV)" label, or a
     * string to customize. When set, the menu's Download item is
     * suppressed. Mutually exclusive with `downloadButton`; if both are
     * set, `downloadButton` wins.
     */
    downloadLink?: boolean | string;
    /** Stretch the table to fill its container's width. */
    fullWidth?: boolean;
  }>(),
  {
    menu: true,
    fullWidth: false,
    downloadMenuLink: "Download",
    downloadButton: false,
  },
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

/** Classes shared by `<th>` and `<td>` for a column: `columnClass` + wrap flag. */
function columnSharedClass(name: string): (string | undefined)[] {
  const cfg = props.columnConfig?.[name];
  return [cfg?.columnClass, cfg?.wrap ? "cell-wrap" : undefined];
}

function headerCellClass(name: string): (string | undefined)[] {
  return columnSharedClass(name);
}

function bodyCellClass(name: string): (string | undefined)[] {
  return [...columnSharedClass(name), props.columnConfig?.[name]?.cellClass];
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

function triggerDownload() {
  downloadCsv(toCsv(), menuFilename());
}

const menuItems = computed<ChartMenuItem[]>(() => {
  if (props.downloadButton || props.downloadLink) return [];
  return [{ label: props.downloadMenuLink, action: triggerDownload }];
});

const downloadLinkText = computed<string | null>(() => {
  if (props.downloadButton) return null;
  const v = props.downloadLink;
  if (!v) return null;
  return typeof v === "string" ? v : "Download data (CSV)";
});

const csvHref = computed<string | null>(() => {
  if (!downloadLinkText.value) return null;
  return `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv())}`;
});

const showMenu = computed(
  () => Boolean(props.menu) && menuItems.value.length > 0,
);
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
              :class="headerCellClass(col.name)"
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
              :class="bodyCellClass(col.name)"
              :style="columnAlignStyle(col.name)"
            >
              {{ cellValue(col, row - 1) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button
      v-if="downloadButton"
      type="button"
      class="data-table-download-button"
      @click="triggerDownload"
    >
      {{ downloadMenuLink }}
    </button>
    <a
      v-else-if="downloadLinkText"
      class="data-table-download-link"
      :href="csvHref!"
      :download="`${menuFilename()}.csv`"
    >
      {{ downloadLinkText }}
    </a>
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
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.Table th.cell-wrap,
.Table td.cell-wrap {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
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

<style>
.data-table-download-button {
  display: inline-flex;
  align-items: center;
  margin-top: 0.75em;
  padding: 0.5em 1em;
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  background: var(--color-bg-0, #fff);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.data-table-download-button:hover {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
}

.data-table-download-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.data-table-download-link {
  display: block;
  text-align: right;
  font-size: var(--font-size-sm);
  margin-top: 0.25em;
}
</style>
