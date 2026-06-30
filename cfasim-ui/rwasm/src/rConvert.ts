// Pure helpers for talking to webR: building R calls from JSON params and
// converting webR's `toJs()` output into the cfasim ModelOutput wire format.
// Deliberately free of any `webr` import so it can be unit-tested without the
// (heavy) webR runtime installed.
import type {
  ColumnDescriptor,
  ModelOutputsWire,
} from "@cfasim-ui/shared/model-output";
import type { JsonValue } from "./rwasmWorkerApi.js";

function assertIdentifier(name: string): void {
  if (!/^[A-Za-z.][A-Za-z0-9._]*$/.test(name)) {
    throw new Error(`Invalid R function name: ${name}`);
  }
}

export function rLiteral(value: JsonValue): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("R arguments must be finite");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `list(${value.map(rLiteral).join(", ")})`;
  return `list(${Object.entries(value)
    .map(([key, val]) => `${key} = ${rLiteral(val)}`)
    .join(", ")})`;
}

export function buildCall(
  fn: string,
  params?: Record<string, JsonValue>,
): string {
  assertIdentifier(fn);
  const args = Object.entries(params ?? {})
    .map(([key, val]) => `${key} = ${rLiteral(val)}`)
    .join(", ");
  return `${fn}(${args})`;
}

function asArrayBuffer(value: unknown, type: string): ArrayBuffer {
  // webR's toJs() collapses a length-1 atomic vector to a bare scalar, so a
  // single-row column arrives here as a number/boolean rather than an array.
  // Wrap it back into a one-element column so the buffer isn't empty.
  const column =
    Array.isArray(value) || ArrayBuffer.isView(value)
      ? (value as Iterable<number | boolean>)
      : [value as number | boolean];
  const values = Array.from(column);
  switch (type) {
    case "f64":
      return new Float64Array(values as number[]).buffer;
    case "i32":
      return new Int32Array(values as number[]).buffer;
    case "u32":
    case "enum":
      return new Uint32Array(values as number[]).buffer;
    case "bool":
      return new Uint8Array(values.map((v) => (v ? 1 : 0))).buffer;
    default:
      throw new Error(`Unsupported R output column type: ${type}`);
  }
}

function arrayFromNamedList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return null;
}

function normalizeColumn(col: ColumnDescriptor): ColumnDescriptor {
  // A single-label enum() collapses its labels to a bare string the same way a
  // single-row column does; restore the array so enum decoding sees string[].
  if (col.enumLabels !== undefined && !Array.isArray(col.enumLabels)) {
    return { ...col, enumLabels: [col.enumLabels as unknown as string] };
  }
  return col;
}

export function normalizeWebRValue(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value, ([key, val]) => [String(key), normalizeWebRValue(val)]),
    );
  }
  if (Array.isArray(value)) return value.map(normalizeWebRValue);
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
  if (isWebRDataJs(value)) return decodeWebRDataJs(value);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, normalizeWebRValue(val)]),
    );
  }
  return value;
}

function isWebRDataJs(value: unknown): value is {
  type: string;
  names?: string[] | null;
  values?: unknown[];
} {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string" &&
    ("values" in value || (value as { type?: string }).type === "null")
  );
}

function decodeWebRDataJs(value: {
  type: string;
  names?: string[] | null;
  values?: unknown[];
}): unknown {
  if (value.type === "null") return null;
  const values = (value.values ?? []).map(normalizeWebRValue);
  const names = value.names ?? null;
  if (names?.some(Boolean)) {
    return Object.fromEntries(names.map((name, i) => [name, values[i]]));
  }
  if (value.type === "list") return values;
  return values.length === 1 ? values[0] : values;
}

export function convertRModelOutputs(value: unknown): ModelOutputsWire | null {
  if (!value || typeof value !== "object") return null;
  const maybe = value as { __modelOutputs?: unknown; outputs?: unknown };
  if (
    !maybe.__modelOutputs ||
    !maybe.outputs ||
    typeof maybe.outputs !== "object"
  ) {
    return null;
  }

  const outputs: ModelOutputsWire["outputs"] = {};
  for (const [name, output] of Object.entries(
    maybe.outputs as Record<string, any>,
  )) {
    const rawColumns = arrayFromNamedList(output.columns) as
      | ColumnDescriptor[]
      | null;
    // R helpers emit each output's column data under `data`.
    const data = arrayFromNamedList(output.data);
    if (!rawColumns || !data) {
      throw new Error(`Invalid R ModelOutput: ${name}`);
    }

    const columns = rawColumns.map(normalizeColumn);
    const buffers = columns.map((col, i) => asArrayBuffer(data[i], col.type));
    const firstColumn = data[0] as { length?: number } | undefined;
    const length =
      typeof output.length === "number"
        ? output.length
        : (firstColumn?.length ?? 0);

    outputs[name] = {
      __modelOutput: true,
      length,
      columns,
      buffers,
    };
  }
  return { __modelOutputs: true, outputs };
}
