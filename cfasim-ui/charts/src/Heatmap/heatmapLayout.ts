/**
 * Pure helpers behind `Heatmap`: shaping long-format rows into its matrix,
 * picking a column label angle, and keyboard navigation over the cells.
 */

/** The matrix `Heatmap` plots: `data[rowIndex][columnIndex]`. */
export interface HeatmapMatrix {
  rows: string[];
  columns: string[];
  data: number[][];
}

/** A field name or an accessor over one long-format record. */
export type CellKey<T> = keyof T | ((record: T) => unknown);

export interface PivotCellsOptions<T> {
  /** Field (or accessor) giving a record's row label. */
  row: CellKey<T>;
  /** Field (or accessor) giving a record's column label. */
  column: CellKey<T>;
  /** Field (or accessor) giving a record's value. */
  value: CellKey<T>;
  /**
   * Row labels in display order. Records with other labels are dropped.
   * Defaults to the labels in first-seen order.
   */
  rows?: readonly string[];
  /** Column labels in display order; defaults to first-seen order. */
  columns?: readonly string[];
}

function accessor<T>(key: CellKey<T>): (record: T) => unknown {
  return typeof key === "function" ? key : (r) => r[key];
}

/**
 * Pivot long-format records (one per cell, e.g. `{ location, model,
 * score }`) into the `rows` / `columns` / `data` a `Heatmap` takes. Labels
 * are stringified; a cell no record covers is `NaN`, and the last record
 * for a cell wins.
 */
export function pivotCells<T>(
  records: readonly T[],
  opts: PivotCellsOptions<T>,
): HeatmapMatrix {
  const rowOf = accessor(opts.row);
  const colOf = accessor(opts.column);
  const valueOf = accessor(opts.value);
  const rows = opts.rows ? [...opts.rows] : [];
  const columns = opts.columns ? [...opts.columns] : [];
  const rowIndex = new Map(rows.map((r, i) => [r, i]));
  const colIndex = new Map(columns.map((c, i) => [c, i]));
  const cells: { r: number; c: number; v: number }[] = [];
  for (const rec of records) {
    const rk = rowOf(rec);
    const ck = colOf(rec);
    if (rk == null || ck == null) continue;
    const rl = String(rk);
    const cl = String(ck);
    let r = rowIndex.get(rl);
    if (r === undefined) {
      if (opts.rows) continue;
      r = rows.push(rl) - 1;
      rowIndex.set(rl, r);
    }
    let c = colIndex.get(cl);
    if (c === undefined) {
      if (opts.columns) continue;
      c = columns.push(cl) - 1;
      colIndex.set(cl, c);
    }
    const raw = valueOf(rec);
    const v =
      raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    cells.push({ r, c, v });
  }
  const data = rows.map(() => new Array<number>(columns.length).fill(NaN));
  for (const { r, c, v } of cells) data[r][c] = v;
  return { rows, columns, data };
}

/** Angles `columnLabelAngle: "auto"` chooses between, steepest last. */
export const AUTO_LABEL_ANGLES = [0, -45, -90] as const;

/**
 * The shallowest angle at which column labels of up to `widest` px do not
 * collide on columns `pitch` px apart: flat when they fit, else the
 * diagonal when its per-label footprint (`fontSize * √2`) fits, else
 * vertical. Slack of 4px keeps neighbors from touching.
 */
export function pickLabelAngle(
  widest: number,
  pitch: number,
  fontSize: number,
): (typeof AUTO_LABEL_ANGLES)[number] {
  const slack = 4;
  if (widest + slack <= pitch) return 0;
  if (fontSize * Math.SQRT2 + slack <= pitch) return -45;
  return -90;
}

/**
 * Room a label of `width` px needs perpendicular to its axis when drawn
 * at `angle` degrees: its projection plus the font's own height.
 */
export function rotatedLabelExtent(
  width: number,
  fontSize: number,
  angle: number,
): number {
  const rad = (Math.min(90, Math.abs(angle)) * Math.PI) / 180;
  return width * Math.sin(rad) + fontSize * Math.cos(rad);
}

/**
 * Horizontal spacing a column label of `width` px needs along its axis at
 * `angle` degrees so neighbors do not collide: either the label's own
 * horizontal span (plus 4px slack) or the pitch where parallel tilted
 * strips of `fontSize + 2` px clear each other, whichever is smaller.
 */
export function rotatedLabelFootprint(
  width: number,
  fontSize: number,
  angle: number,
): number {
  const rad = (Math.min(90, Math.abs(angle)) * Math.PI) / 180;
  const sin = Math.sin(rad);
  const span = width * Math.cos(rad) + (fontSize + 2) * sin + 4;
  return sin === 0 ? span : Math.min(span, (fontSize + 2) / sin);
}

/**
 * A label angle as its equivalent in [-90, 90]: full turns drop out, and an
 * angle that would draw the text upside down flips by 180 so it stays
 * readable (270 is -90, 135 is -45).
 */
export function normalizeLabelAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  let normalized = ((((angle + 180) % 360) + 360) % 360) - 180;
  if (normalized > 90) normalized -= 180;
  else if (normalized < -90) normalized += 180;
  return normalized;
}

/**
 * How far a label of `width` px reaches sideways from its tick at `angle`
 * degrees: half its width when flat (it is centered), else its horizontal
 * projection plus half the tilted line's thickness.
 */
export function labelReach(
  width: number,
  fontSize: number,
  angle: number,
): number {
  if (angle === 0) return width / 2;
  const rad = (Math.min(90, Math.abs(angle)) * Math.PI) / 180;
  return width * Math.cos(rad) + (fontSize / 2) * Math.sin(rad);
}

/** The widest label whose `labelReach` stays within `reach` px. */
export function labelWidthForReach(
  reach: number,
  fontSize: number,
  angle: number,
): number {
  if (angle === 0) return Math.max(0, reach * 2);
  const rad = (Math.min(90, Math.abs(angle)) * Math.PI) / 180;
  const cos = Math.cos(rad);
  if (cos < 1e-6) return Infinity;
  return Math.max(0, (reach - (fontSize / 2) * Math.sin(rad)) / cos);
}

/** The widest label whose `rotatedLabelExtent` stays within `extent` px. */
export function labelWidthForExtent(
  extent: number,
  fontSize: number,
  angle: number,
): number {
  const rad = (Math.min(90, Math.abs(angle)) * Math.PI) / 180;
  const sin = Math.sin(rad);
  if (sin < 1e-6) return Infinity;
  return Math.max(0, (extent - fontSize * Math.cos(rad)) / sin);
}

export interface ColumnLabelSidePaddingOptions {
  /** Measured width of each column's label, in column order. */
  widths: readonly number[];
  fontSize: number;
  angle: number;
  /** The side tilted labels reach toward; flat labels reach both. */
  side: "left" | "right";
  /** Distance between neighboring column centers. */
  pitch: number;
  /** Pixels between the chart's left edge and the first column's edge. */
  leftRoom: number;
  /** Pixels between the last column's edge and the chart's right edge. */
  rightRoom: number;
}

/**
 * Padding to add on the chart's left and right so the column labels stay
 * inside it, zero where they already fit. Padding narrows the columns and
 * so pulls every tick inward by its share, which the amounts allow for.
 */
export function columnLabelSidePadding(opts: ColumnLabelSidePaddingOptions): {
  left: number;
  right: number;
} {
  const { widths, fontSize, angle, side, pitch } = opts;
  const count = widths.length;
  let left = 0;
  let right = 0;
  for (let i = 0; i < count; i++) {
    const reach = labelReach(widths[i], fontSize, angle);
    if (angle === 0 || side === "left") {
      const columnsToEdge = i + 0.5;
      const overhang = reach - (opts.leftRoom + columnsToEdge * pitch);
      left = Math.max(left, overhang / (1 - columnsToEdge / count));
    }
    if (angle === 0 || side === "right") {
      const columnsToEdge = count - i - 0.5;
      const overhang = reach - (opts.rightRoom + columnsToEdge * pitch);
      right = Math.max(right, overhang / (1 - columnsToEdge / count));
    }
  }
  return { left, right };
}

/**
 * Shorten `text` with `…` so its measured width fits `maxWidth`.
 */
export function truncateLabel(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string {
  if (maxWidth <= 0 || measure(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid)}…`) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo)}…` : "…";
}

/**
 * A keyboard move over the cell grid plus the row-label column, which sits
 * at column `-1` when `rowLabels` is set. Returns the new position, or
 * null when the key is not a navigation key. Moves clamp at the edges.
 */
export function moveCell(
  pos: { row: number; column: number },
  key: string,
  rowCount: number,
  columnCount: number,
  rowLabels: boolean,
): { row: number; column: number } | null {
  const minCol = rowLabels ? -1 : 0;
  const maxCol = columnCount - 1;
  let { row, column } = pos;
  switch (key) {
    case "ArrowRight":
      column = Math.min(maxCol, column + 1);
      break;
    case "ArrowLeft":
      column = Math.max(minCol, column - 1);
      break;
    case "ArrowDown":
      row = Math.min(rowCount - 1, row + 1);
      break;
    case "ArrowUp":
      row = Math.max(0, row - 1);
      break;
    case "Home":
      column = minCol;
      break;
    case "End":
      column = maxCol;
      break;
    default:
      return null;
  }
  return { row, column };
}
