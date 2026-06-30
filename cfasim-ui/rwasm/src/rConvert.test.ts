import { describe, expect, it } from "vitest";
import {
  buildCall,
  convertRModelOutputs,
  normalizeWebRValue,
} from "./rConvert.js";

// Minimal stand-ins for webR's `toJs()` output shape (WebRDataJs): every R
// object becomes `{ type, names, values }`, and atomic vectors of length 1
// are collapsed to a bare scalar by the time they reach our conversion code.
const dbl = (...values: number[]) => ({ type: "double", names: null, values });
const int = (...values: number[]) => ({ type: "integer", names: null, values });
const chr = (...values: string[]) => ({
  type: "character",
  names: null,
  values,
});
const lgl = (...values: boolean[]) => ({
  type: "logical",
  names: null,
  values,
});
const namedList = (obj: Record<string, unknown>) => ({
  type: "list",
  names: Object.keys(obj),
  values: Object.values(obj),
});
const unnamedList = (...items: unknown[]) => ({
  type: "list",
  names: null,
  values: items,
});

interface ColumnSpec {
  name: string;
  type: string;
  enumLabels?: string[];
}

function modelOutput(columns: ColumnSpec[], data: unknown[], length: number) {
  return namedList({
    length: int(length),
    columns: unnamedList(
      ...columns.map((c) =>
        namedList({
          name: chr(c.name),
          type: chr(c.type),
          ...(c.enumLabels ? { enumLabels: chr(...c.enumLabels) } : {}),
        }),
      ),
    ),
    data: unnamedList(...data),
  });
}

function modelOutputs(outputs: Record<string, unknown>) {
  return namedList({ __modelOutputs: lgl(true), outputs: namedList(outputs) });
}

function convert(toJs: unknown) {
  return convertRModelOutputs(normalizeWebRValue(toJs));
}

const F64_COLS: ColumnSpec[] = [
  { name: "time", type: "f64" },
  { name: "values", type: "f64" },
];

describe("convertRModelOutputs", () => {
  it("converts a multi-row output to typed-array buffers", () => {
    const wire = convert(
      modelOutputs({
        series: modelOutput(F64_COLS, [dbl(0, 1, 2), dbl(0, 2.5, 5)], 3),
      }),
    );
    const series = wire!.outputs.series;
    expect(series.length).toBe(3);
    expect(Array.from(new Float64Array(series.buffers[0]))).toEqual([0, 1, 2]);
    expect(Array.from(new Float64Array(series.buffers[1]))).toEqual([
      0, 2.5, 5,
    ]);
  });

  it("keeps single-row column data instead of producing empty buffers", () => {
    // Regression: webR collapses a length-1 vector to a scalar, which used to
    // yield length:1 with zero-length buffers (reachable from the template by
    // setting Steps = 1).
    const wire = convert(
      modelOutputs({
        series: modelOutput(F64_COLS, [dbl(0), dbl(0)], 1),
      }),
    );
    const series = wire!.outputs.series;
    expect(series.length).toBe(1);
    expect(series.buffers[0].byteLength).toBe(8);
    expect(Array.from(new Float64Array(series.buffers[0]))).toEqual([0]);
    expect(Array.from(new Float64Array(series.buffers[1]))).toEqual([0]);
  });

  it("encodes integer, unsigned, and boolean columns", () => {
    const wire = convert(
      modelOutputs({
        t: modelOutput(
          [
            { name: "i", type: "i32" },
            { name: "u", type: "u32" },
            { name: "b", type: "bool" },
          ],
          [int(-1, 2), int(0, 7), lgl(true, false)],
          2,
        ),
      }),
    );
    const t = wire!.outputs.t;
    expect(Array.from(new Int32Array(t.buffers[0]))).toEqual([-1, 2]);
    expect(Array.from(new Uint32Array(t.buffers[1]))).toEqual([0, 7]);
    expect(Array.from(new Uint8Array(t.buffers[2]))).toEqual([1, 0]);
  });

  it("preserves enum labels", () => {
    const wire = convert(
      modelOutputs({
        e: modelOutput(
          [{ name: "state", type: "enum", enumLabels: ["S", "I", "R"] }],
          [int(0, 1, 2)],
          3,
        ),
      }),
    );
    expect(wire!.outputs.e.columns[0].enumLabels).toEqual(["S", "I", "R"]);
  });

  it("restores a single enum label to an array", () => {
    const wire = convert(
      modelOutputs({
        e: modelOutput(
          [{ name: "state", type: "enum", enumLabels: ["S"] }],
          [int(0, 0)],
          2,
        ),
      }),
    );
    expect(wire!.outputs.e.columns[0].enumLabels).toEqual(["S"]);
  });

  it("returns null for values that are not model outputs", () => {
    expect(convert(dbl(1, 2, 3))).toBeNull();
    expect(convert(namedList({ a: dbl(1) }))).toBeNull();
  });
});

describe("buildCall", () => {
  it("renders named arguments as R literals", () => {
    expect(buildCall("simulate", { steps: 10, rate: 2.5 })).toBe(
      "simulate(steps = 10, rate = 2.5)",
    );
    expect(buildCall("run")).toBe("run()");
  });

  it("escapes string arguments so they can't break out of the literal", () => {
    expect(buildCall("f", { x: 'a"); stop("x' })).toBe(
      'f(x = "a\\"); stop(\\"x")',
    );
  });

  it("maps booleans and null to R keywords", () => {
    expect(buildCall("f", { a: true, b: false, c: null })).toBe(
      "f(a = TRUE, b = FALSE, c = NULL)",
    );
  });

  it("rejects non-finite numbers and unsafe function names", () => {
    expect(() => buildCall("f", { x: Infinity })).toThrow(/finite/);
    expect(() => buildCall("system('rm')")).toThrow(/Invalid R function name/);
  });
});
