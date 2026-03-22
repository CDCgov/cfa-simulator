<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import type { ModelOutput } from "@cfasim-ui/shared";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { downloadCsv } from "../ChartMenu/download.js";

export type TableRecord = Record<string, ArrayLike<number | string | boolean>>;
export type TableData = TableRecord | ModelOutput;
export type ColumnWidth = "small" | "medium" | "large";
export type ColumnAlign = "left" | "center" | "right";

export interface ColumnConfig {
  label?: string;
  width?: ColumnWidth | number;
  align?: ColumnAlign;
  cellClass?: string;
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
  }>(),
  { menu: true },
);

function columnLabel(name: string): string {
  return props.columnConfig?.[name]?.label ?? name;
}

function columnStyle(name: string): Record<string, string> | undefined {
  const w = props.columnConfig?.[name]?.width;
  if (w == null) return undefined;
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
  return typeof props.menu === "string" ? props.menu : "data";
}

function escapeCsvField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function toCsv(): string {
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
  { label: "Download CSV", action: () => downloadCsv(toCsv(), menuFilename()) },
]);
</script>

<template>
  <div class="TableOuter" :class="{ 'has-menu': menu }">
    <ChartMenu v-if="menu" :items="menuItems" />
    <div class="TableWrapper">
      <table class="Table">
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

.TableOuter.has-menu {
  padding-top: 32px;
}

.TableOuter:hover :deep(.chart-menu-button) {
  opacity: 1;
}

.TableWrapper {
  overflow-x: auto;
  font-size: var(--font-size-sm);
}

.Table {
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--color-border);
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
</style>
