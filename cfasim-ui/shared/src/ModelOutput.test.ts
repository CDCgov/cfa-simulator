import { describe, it, expect } from "vitest";
import { ModelOutput, DATE_MISSING, isoDate } from "./ModelOutput.js";
import type { ModelOutputWire, ModelOutputsWire } from "./ModelOutput.js";
import { modelOutputToCSV } from "./csv.js";
import { unwrapResponse } from "./transferUtils.js";

describe("ModelOutput", () => {
  it("exposes typed columns, descriptors, and enum labels", () => {
    const output = new ModelOutput(
      2,
      [
        { name: "time", type: "f64" },
        { name: "ids", type: "u32" },
        { name: "status", type: "enum", enumLabels: ["S", "R"] },
      ],
      [
        new Float64Array([0.5, 1.5]),
        new Uint32Array([10, 20]),
        new Uint32Array([0, 1]),
      ],
    );
    expect(output.names).toEqual(["time", "ids", "status"]);
    expect(output.column("ids")).toEqual(new Uint32Array([10, 20]));
    expect(output.label("status", 1)).toBe("R");
    expect(output.descriptor("status").enumLabels).toEqual(["S", "R"]);
    expect(() => output.column("nope")).toThrow("Unknown column: nope");
    expect(() => output.label("time", 0)).toThrow("not an enum");
  });

  it("reconstructs single and named outputs from wire buffers", () => {
    const singleWire: ModelOutputWire = {
      __modelOutput: true,
      length: 2,
      columns: [
        { name: "x", type: "f64" },
        { name: "flag", type: "bool" },
      ],
      buffers: [
        new Float64Array([1.5, 2.5]).buffer,
        new Uint8Array([1, 0]).buffer,
      ],
    };
    const single = ModelOutput.fromWire(singleWire);
    expect(single.column("x")).toEqual(new Float64Array([1.5, 2.5]));
    expect(single.column("flag")).toEqual(new Uint8Array([1, 0]));

    const multiWire: ModelOutputsWire = {
      __modelOutputs: true,
      outputs: {
        epi: {
          __modelOutput: true,
          length: 2,
          columns: [{ name: "infections", type: "f64" }],
          buffers: [new Float64Array([100, 200]).buffer],
        },
      },
    };
    const record = ModelOutput.recordFromWire(multiWire);
    expect(record.epi.column("infections")).toEqual(
      new Float64Array([100, 200]),
    );
  });

  it("formats CSV, decodes date columns, and unwraps worker responses", () => {
    const output = new ModelOutput(
      2,
      [
        { name: "time", type: "f64" },
        { name: "active", type: "bool" },
        { name: "status", type: "enum", enumLabels: ["S", "R"] },
        { name: "when", type: "date" },
      ],
      [
        new Float64Array([0.5, 1.5]),
        new Uint8Array([1, 0]),
        new Uint32Array([0, 1]),
        new Uint32Array([20458, DATE_MISSING]),
      ],
    );
    expect(output.dates("when")).toEqual(["2026-01-05", null]);
    expect(isoDate(0)).toBe("1970-01-01");
    expect(isoDate(2_932_897)).toBe("10000-01-01");
    expect(isoDate(4_000_000_000)).toBeNull();
    expect(() => output.dates("time")).toThrow();
    expect(modelOutputToCSV(output)).toBe(
      "time,active,status,when\n0.5,true,S,2026-01-05\n1.5,false,R,",
    );
    expect(modelOutputToCSV(new ModelOutput(0, [], []))).toBe("");

    const unwrapped = unwrapResponse({
      id: 1,
      modelOutputs: {
        outputs: {
          data: {
            length: 2,
            columns: [{ name: "val", type: "f64" }],
            buffers: [new Float64Array([3.14, 2.71]).buffer],
          },
        },
      },
    }) as Record<string, ModelOutput>;
    expect(unwrapped.data).toBeInstanceOf(ModelOutput);
    expect(
      unwrapResponse({
        id: 2,
        buffer: new Float64Array([1, 2]).buffer,
        bufferType: "Float64Array",
      }),
    ).toEqual(new Float64Array([1, 2]));
    expect(unwrapResponse({ id: 3, result: "hello" })).toBe("hello");
  });
});
