export type ColumnType = "i32" | "u32" | "f64" | "bool" | "enum" | "date";

/** Value of a `date` column with no date (`DATE_MISSING` on the Python side). */
export const DATE_MISSING = 0xffffffff;
const DAY_MS = 86_400_000;

export interface ColumnDescriptor {
  name: string;
  type: ColumnType;
  enumLabels?: string[];
}

export type TypedColumn = Float64Array | Int32Array | Uint32Array | Uint8Array;

export interface ModelOutputWire {
  __modelOutput: true;
  length: number;
  columns: ColumnDescriptor[];
  buffers: ArrayBuffer[];
}

export interface ModelOutputsWire {
  __modelOutputs: true;
  outputs: Record<string, ModelOutputWire>;
}

export const COLUMN_TYPE_TO_CTOR: Record<
  ColumnType,
  { new (buffer: ArrayBuffer): TypedColumn; BYTES_PER_ELEMENT: number }
> = {
  f64: Float64Array,
  i32: Int32Array,
  u32: Uint32Array,
  bool: Uint8Array,
  enum: Uint32Array,
  date: Uint32Array,
};

/** ISO `yyyy-mm-dd` for a `date` column value (days since 1970-01-01). */
export function isoDate(days: number): string | null {
  const date = new Date(days * DAY_MS);
  if (days === DATE_MISSING || Number.isNaN(date.getTime())) return null;
  // Not toISOString, which writes years past 9999 as "+010000".
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export class ModelOutput {
  readonly length: number;
  readonly columns: readonly ColumnDescriptor[];
  readonly buffers: readonly TypedColumn[];

  constructor(
    length: number,
    columns: ColumnDescriptor[],
    buffers: TypedColumn[],
  ) {
    this.length = length;
    this.columns = columns;
    this.buffers = buffers;
  }

  column(name: string): TypedColumn {
    const idx = this.columns.findIndex((c) => c.name === name);
    if (idx === -1) throw new Error(`Unknown column: ${name}`);
    return this.buffers[idx];
  }

  descriptor(name: string): ColumnDescriptor {
    const idx = this.columns.findIndex((c) => c.name === name);
    if (idx === -1) throw new Error(`Unknown column: ${name}`);
    return this.columns[idx];
  }

  label(columnName: string, index: number): string {
    const desc = this.descriptor(columnName);
    if (desc.type !== "enum" || !desc.enumLabels) {
      throw new Error(`Column ${columnName} is not an enum`);
    }
    return desc.enumLabels[index];
  }

  /** A `date` column as ISO strings (`null` where the date is missing). */
  dates(columnName: string): (string | null)[] {
    if (this.descriptor(columnName).type !== "date") {
      throw new Error(`Column ${columnName} is not a date`);
    }
    return Array.from(this.column(columnName), isoDate);
  }

  get names(): string[] {
    return this.columns.map((c) => c.name);
  }

  static fromWire(wire: ModelOutputWire): ModelOutput {
    const typed = wire.columns.map((col, i) => {
      const Ctor = COLUMN_TYPE_TO_CTOR[col.type];
      return new Ctor(wire.buffers[i]);
    });
    return new ModelOutput(wire.length, wire.columns, typed);
  }

  static recordFromWire(wire: ModelOutputsWire): Record<string, ModelOutput> {
    const result: Record<string, ModelOutput> = {};
    for (const [key, outputWire] of Object.entries(wire.outputs)) {
      result[key] = ModelOutput.fromWire(outputWire);
    }
    return result;
  }
}
