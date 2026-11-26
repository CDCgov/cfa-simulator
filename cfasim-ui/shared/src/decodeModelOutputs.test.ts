import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeModelOutputs } from "./decodeModelOutputs.js";

const FIXTURES = resolve(__dirname, "../../../cfasim-model-py/tests/fixtures");

function fixtureBuffer(name: string): ArrayBuffer {
  const bytes = readFileSync(resolve(FIXTURES, name));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

const expected = JSON.parse(
  readFileSync(resolve(FIXTURES, "sample.columns.json"), "utf8"),
) as Record<string, Record<string, number[]>>;

describe("decodeModelOutputs", () => {
  it("decodes the shared fixture and validates header alignment", () => {
    const buffer = fixtureBuffer("sample.cfasim");
    const headerLength = new DataView(buffer).getUint32(0, true);
    const header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)),
    );
    const committed = JSON.parse(
      readFileSync(resolve(FIXTURES, "sample.header.json"), "utf8"),
    );
    expect(header).toEqual(committed);
    expect((4 + headerLength) % 8).toBe(0);

    const outputs = decodeModelOutputs(buffer);
    expect(Object.keys(outputs).sort()).toEqual(["empty", "series"]);
    for (const [table, columns] of Object.entries(expected)) {
      for (const [name, values] of Object.entries(columns)) {
        expect(Array.from(outputs[table].column(name))).toEqual(values);
      }
    }
    expect(outputs.series.column("time")).toBeInstanceOf(Float64Array);
    expect(outputs.series.column("delta")).toBeInstanceOf(Int32Array);
    expect(outputs.series.column("count")).toBeInstanceOf(Uint32Array);
    expect(outputs.series.column("flag")).toBeInstanceOf(Uint8Array);
    expect(
      outputs.series.label("status", outputs.series.column("status")[1]),
    ).toBe("R");
    expect(outputs.empty.length).toBe(0);
  });

  it("rejects truncated and unsupported-version files", () => {
    const buffer = fixtureBuffer("sample.cfasim");
    expect(() =>
      decodeModelOutputs(buffer.slice(0, buffer.byteLength - 4)),
    ).toThrow(/truncated/);
    expect(() => decodeModelOutputs(buffer.slice(0, 2))).toThrow(/truncated/);

    const bad = new Uint8Array(buffer.slice(0));
    const versionIdx =
      4 +
      new TextDecoder().decode(bad.subarray(4, 24)).indexOf('"version":1') +
      10;
    bad[versionIdx] = "2".charCodeAt(0);
    expect(() => decodeModelOutputs(bad.buffer as ArrayBuffer)).toThrow(
      /version/,
    );
  });
});
