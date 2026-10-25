<script setup lang="ts">
import { computed, useSlots, watch } from "vue";
import type { CSSProperties } from "vue";
import {
  formatNumber,
  type ModelOutput,
  type NumberFormat,
  isoDate,
  DATE_MISSING,
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
export type SortDirection = "asc" | "desc";
export type CellTemplateFn = (
  value: CellValue | undefined,
  row: number,
) => string | undefined;

export interface CellSlotProps {
  /** Raw cell value; `undefined` past the end of a short column. */
  value: CellValue | undefined;
  /** The cell's default text, with `format`, enum labels and dates applied. */
  text: string;
  /** Row index in the source data, unaffected by sorting. */
  row: number;
  column: string;
}

export interface TableSort {
  column: string;
  direction: SortDirection;
}

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
  /** Override the table-level `sortable` prop for this column. */
  sortable?: boolean;
  /**
   * Name of a scoped slot (`<template #name>`) that renders this column's
   * body cells. Several columns can share one template. A function picks
   * the template per cell; returning `undefined` renders plain text.
   * Display only: sorting uses raw values and CSV exports use the
   * formatted text.
   */
  template?: string | CellTemplateFn;
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
    /**
     * Make column headers clickable to sort rows. Clicking cycles
     * ascending, descending, then back to the original order. Use
     * `sortable` in `columnConfig` to opt individual columns in or out.
     */
    sortable?: boolean;
  }>(),
  {
    menu: true,
    fullWidth: false,
    downloadMenuLink: "Download",
    downloadButton: false,
    sortable: false,
  },
);

defineSlots<{
  /** Cell templates, named by `columnConfig[column].template`. */
  [name: string]: ((props: CellSlotProps) => unknown) | undefined;
}>();
const slots = useSlots();

/** Slot rendering a column's cells, or `undefined` for plain text. */
function cellSlotName(col: Column, row: number): string | undefined {
  const t = props.columnConfig?.[col.name]?.template;
  const name =
    typeof t === "function" ? t(col.values[row] ?? undefined, row) : t;
  return name && slots[name] ? name : undefined;
}

function cellSlotProps(col: Column, row: number): CellSlotProps {
  const v = col.values[row];
  return {
    value: v ?? undefined,
    text: cellValue(col, row),
    row,
    column: col.name,
  };
}

/** Current sort; `null` keeps the data's own row order. */
const sort = defineModel<TableSort | null>("sort", { default: null });

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
  /** `date` columns hold days since 1970-01-01. */
  isDate?: boolean;
}

const columns = computed<Column[]>(() => {
  const d = props.data;
  if (isModelOutput(d)) {
    return d.columns.map((col) => ({
      name: col.name,
      values: d.column(col.name),
      enumLabels: col.enumLabels,
      isDate: col.type === "date",
    }));
  }
  return Object.entries(d).map(([name, values]) => ({ name, values }));
});

const totalRows = computed(() => {
  let max = 0;
  for (const col of columns.value) max = Math.max(max, col.values.length);
  return max;
});

function isSortable(name: string): boolean {
  return props.columnConfig?.[name]?.sortable ?? props.sortable;
}

const collator = new Intl.Collator(undefined, { numeric: true });

/** Comparable key for a cell, or `null` for a missing value. */
function sortKey(col: Column, row: number): number | string | null {
  const v = col.values[row];
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") return v === "" ? null : v;
  if (Number.isNaN(v)) return null;
  if (col.enumLabels) return col.enumLabels[v] || null;
  if (col.isDate && v === DATE_MISSING) return null;
  return v;
}

function compareKeys(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string")
    return collator.compare(a, b);
  return typeof a === "number" ? -1 : 1;
}

/** Original row indices in display order, already cut to `maxRows`. */
const rowOrder = computed<number[]>(() => {
  const order = Array.from({ length: totalRows.value }, (_, i) => i);
  const s = sort.value;
  const col = s && columns.value.find((c) => c.name === s.column);
  if (col) {
    const keys = order.map((r) => sortKey(col, r));
    const sign = s.direction === "desc" ? -1 : 1;
    // Missing values stay last in both directions.
    order.sort((a, b) => {
      const ka = keys[a];
      const kb = keys[b];
      if (ka === null || kb === null)
        return ka === kb ? 0 : ka === null ? 1 : -1;
      return sign * compareKeys(ka, kb);
    });
  }
  return props.maxRows ? order.slice(0, props.maxRows) : order;
});

watch(columns, (cols) => {
  const s = sort.value;
  if (s && !cols.some((c) => c.name === s.column)) sort.value = null;
});

function sortDirection(name: string): SortDirection | undefined {
  return sort.value?.column === name ? sort.value.direction : undefined;
}

function ariaSort(name: string): "ascending" | "descending" | undefined {
  const dir = sortDirection(name);
  if (!dir) return undefined;
  return dir === "asc" ? "ascending" : "descending";
}

function toggleSort(name: string) {
  const dir = sortDirection(name);
  if (!dir) sort.value = { column: name, direction: "asc" };
  else if (dir === "asc") sort.value = { column: name, direction: "desc" };
  else sort.value = null;
}

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
  if (col.isDate && typeof v === "number") return isoDate(v) ?? "";
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
  const headers = cols.map((c) => escapeCsvField(columnLabel(c.name)));
  const lines = [headers.join(",")];
  for (const r of rowOrder.value) {
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
              :aria-sort="ariaSort(col.name)"
            >
              <button
                v-if="isSortable(col.name)"
                type="button"
                class="data-table-sort-button"
                @click="toggleSort(col.name)"
              >
                <span class="data-table-sort-label">{{
                  columnLabel(col.name)
                }}</span>
                <svg
                  class="data-table-sort-icon"
                  :class="sortDirection(col.name)"
                  viewBox="0 0 8 12"
                  width="8"
                  height="12"
                  aria-hidden="true"
                >
                  <path class="sort-up" d="M1 5 4 1.5 7 5Z" />
                  <path class="sort-down" d="M1 7 4 10.5 7 7Z" />
                </svg>
              </button>
              <template v-else>{{ columnLabel(col.name) }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rowOrder" :key="row">
            <td
              v-for="col in columns"
              :key="col.name"
              :class="bodyCellClass(col.name)"
              :style="columnAlignStyle(col.name)"
            >
              <slot
                v-if="cellSlotName(col, row)"
                :name="cellSlotName(col, row)!"
                v-bind="cellSlotProps(col, row)"
              />
              <template v-else>{{ cellValue(col, row) }}</template>
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
  max-width: 100%;
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

.data-table-sort-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: pointer;
}

.data-table-sort-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.Table th[aria-sort] .data-table-sort-button {
  color: var(--color-text);
}

.cell-wrap .data-table-sort-label {
  overflow: visible;
}

.data-table-sort-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.data-table-sort-icon {
  flex: none;
  fill: currentColor;
}

.data-table-sort-icon path {
  opacity: 0.25;
}

.data-table-sort-button:hover .data-table-sort-icon path {
  opacity: 0.5;
}

.data-table-sort-button .data-table-sort-icon.asc .sort-up,
.data-table-sort-button .data-table-sort-icon.desc .sort-down {
  opacity: 1;
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
