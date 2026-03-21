import { describe, it, expect } from "vitest";
import { ModelOutput } from "./ModelOutput.js";
import type {
  ModelOutputWire,
  ModelOutputsWire,
  ColumnDescriptor,
} from "./ModelOutput.js";
import { modelOutputToCSV } from "./csv.js";
import {
  postModelOutputsWithTransfer,
  unwrapResponse,
} from "./transferUtils.js";
import type { TransferableResponse } from "./transferUtils.js";

describe("ModelOutput", () => {
  function makeOutput() {
    const columns: ColumnDescriptor[] = [
      { name: "time", type: "f64" },
      { name: "count", type: "i32" },
      { name: "active", type: "bool" },
      { name: "status", type: "enum", enumLabels: ["S", "I", "R"] },
    ];
    const buffers = [
      new Float64Array([0.0, 1.0, 2.0]),
      new Int32Array([10, 20, 30]),
      new Uint8Array([1, 0, 1]),
      new Uint32Array([0, 1, 2]),
    ];
    return new ModelOutput(3, columns, buffers);
  }

  it("accesses columns by name", () => {
    const output = makeOutput();
    expect(output.column("time")).toEqual(new Float64Array([0.0, 1.0, 2.0]));
    expect(output.column("count")).toEqual(new Int32Array([10, 20, 30]));
    expect(output.column("active")).toEqual(new Uint8Array([1, 0, 1]));
    expect(output.column("status")).toEqual(new Uint32Array([0, 1, 2]));
  });

  it("supports u32 columns", () => {
    const output = new ModelOutput(
      2,
      [{ name: "ids", type: "u32" }],
      [new Uint32Array([100, 200])],
    );
    expect(output.column("ids")).toEqual(new Uint32Array([100, 200]));
  });

  it("throws on unknown column", () => {
    const output = makeOutput();
    expect(() => output.column("nope")).toThrow("Unknown column: nope");
  });

  it("returns column names", () => {
    const output = makeOutput();
    expect(output.names).toEqual(["time", "count", "active", "status"]);
  });

  it("resolves enum labels", () => {
    const output = makeOutput();
    expect(output.label("status", 0)).toBe("S");
    expect(output.label("status", 1)).toBe("I");
    expect(output.label("status", 2)).toBe("R");
  });

  it("throws when resolving label on non-enum column", () => {
    const output = makeOutput();
    expect(() => output.label("time", 0)).toThrow("not an enum");
  });

  it("returns descriptor", () => {
    const output = makeOutput();
    expect(output.descriptor("status")).toEqual({
      name: "status",
      type: "enum",
      enumLabels: ["S", "I", "R"],
    });
  });
});

describe("ModelOutput.fromWire", () => {
  it("reconstructs typed arrays from ArrayBuffers", () => {
    const wire: ModelOutputWire = {
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

    const output = ModelOutput.fromWire(wire);
    expect(output.length).toBe(2);
    expect(output.column("x")).toEqual(new Float64Array([1.5, 2.5]));
    expect(output.column("flag")).toEqual(new Uint8Array([1, 0]));
  });

  it("reconstructs u32 columns from ArrayBuffers", () => {
    const wire: ModelOutputWire = {
      __modelOutput: true,
      length: 3,
      columns: [{ name: "ids", type: "u32" }],
      buffers: [new Uint32Array([10, 20, 30]).buffer],
    };

    const output = ModelOutput.fromWire(wire);
    expect(output.column("ids")).toEqual(new Uint32Array([10, 20, 30]));
  });
});

describe("ModelOutput.recordFromWire", () => {
  it("reconstructs multiple named outputs", () => {
    const wire: ModelOutputsWire = {
      __modelOutputs: true,
      outputs: {
        epi: {
          __modelOutput: true,
          length: 2,
          columns: [{ name: "infections", type: "f64" }],
          buffers: [new Float64Array([100, 200]).buffer],
        },
        summary: {
          __modelOutput: true,
          length: 1,
          columns: [{ name: "total", type: "i32" }],
          buffers: [new Int32Array([300]).buffer],
        },
      },
    };

    const record = ModelOutput.recordFromWire(wire);
    expect(Object.keys(record)).toEqual(["epi", "summary"]);
    expect(record.epi.length).toBe(2);
    expect(record.epi.column("infections")).toEqual(
      new Float64Array([100, 200]),
    );
    expect(record.summary.length).toBe(1);
    expect(record.summary.column("total")).toEqual(new Int32Array([300]));
  });
});

describe("modelOutputToCSV", () => {
  it("formats all column types correctly", () => {
    const columns: ColumnDescriptor[] = [
      { name: "time", type: "f64" },
      { name: "count", type: "i32" },
      { name: "active", type: "bool" },
      { name: "status", type: "enum", enumLabels: ["S", "I", "R"] },
    ];
    const output = new ModelOutput(2, columns, [
      new Float64Array([0.5, 1.5]),
      new Int32Array([10, 20]),
      new Uint8Array([1, 0]),
      new Uint32Array([0, 2]),
    ]);

    const csv = modelOutputToCSV(output);
    expect(csv).toBe("time,count,active,status\n0.5,10,true,S\n1.5,20,false,R");
  });

  it("handles empty output", () => {
    const output = new ModelOutput(0, [], []);
    expect(modelOutputToCSV(output)).toBe("");
  });
});

describe("transfer protocol with ModelOutputs", () => {
  it("unwrapResponse reconstructs Record<string, ModelOutput>", () => {
    const response: TransferableResponse = {
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
    };

    const result = unwrapResponse(response) as Record<string, ModelOutput>;
    expect(result.data).toBeInstanceOf(ModelOutput);
    expect(result.data.column("val")).toEqual(new Float64Array([3.14, 2.71]));
  });

  it("unwrapResponse still handles single typed arrays", () => {
    const buf = new Float64Array([1, 2, 3]).buffer;
    const response: TransferableResponse = {
      id: 1,
      buffer: buf,
      bufferType: "Float64Array",
    };
    const result = unwrapResponse(response);
    expect(result).toEqual(new Float64Array([1, 2, 3]));
  });

  it("unwrapResponse still handles plain results", () => {
    const response: TransferableResponse = {
      id: 1,
      result: "hello",
    };
    expect(unwrapResponse(response)).toBe("hello");
  });
});
