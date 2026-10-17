import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeModelOutputs } from "./decodeModelOutputs.js";

// Shared protocol fixtures, written by the Python reference implementation.
// (__dirname rather than import.meta.url: happy-dom gives the latter an http scheme.)
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
  it("decodes the shared fixture into ModelOutput tables", () => {
    const outputs = decodeModelOutputs(fixtureBuffer("sample.cfasim"));
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
    const status = outputs.series.column("status");
    expect(outputs.series.label("status", status[1])).toBe("R");
    expect(outputs.empty.length).toBe(0);
  });

  it("matches the committed header", () => {
    const buf = fixtureBuffer("sample.cfasim");
    const headerLength = new DataView(buf).getUint32(0, true);
    const header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buf, 4, headerLength)),
    );
    const dataStart = 4 + headerLength;
    const committed = JSON.parse(
      readFileSync(resolve(FIXTURES, "sample.header.json"), "utf8"),
    );
    expect(header).toEqual(committed);
    expect(dataStart % 8).toBe(0);
  });

  it("rejects truncated and malformed files", () => {
    const buf = fixtureBuffer("sample.cfasim");
    expect(() => decodeModelOutputs(buf.slice(0, buf.byteLength - 4))).toThrow(
      /truncated/,
    );
    expect(() => decodeModelOutputs(buf.slice(0, 2))).toThrow(/truncated/);
    const bad = new Uint8Array(buf.slice(0));
    const text = new TextDecoder().decode(bad.subarray(4, 24));
    const idx = 4 + text.indexOf('"version":1') + '"version":'.length;
    bad[idx] = "2".charCodeAt(0);
    expect(() => decodeModelOutputs(bad.buffer as ArrayBuffer)).toThrow(
      /version/,
    );
  });
});
