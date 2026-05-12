import { describe, it, expect } from "vitest";
import { seriesToCsv, categoricalToCsv } from "./seriesCsv.js";

describe("seriesToCsv", () => {
  it("returns empty string for no series", () => {
    expect(seriesToCsv([])).toBe("");
  });

  it("emits single-series header as index,value", () => {
    expect(seriesToCsv([{ data: [10, 20, 30] }])).toBe(
      "index,value\n0,10\n1,20\n2,30",
    );
  });

  it("emits multi-series headers as series_0, series_1, ...", () => {
    expect(seriesToCsv([{ data: [1, 2] }, { data: [3, 4] }])).toBe(
      "index,series_0,series_1\n0,1,3\n1,2,4",
    );
  });

  it("uses an x column when all series share the same x reference", () => {
    const x = [10, 20, 30];
    expect(
      seriesToCsv([
        { data: [1, 2, 3], x },
        { data: [4, 5, 6], x },
      ]),
    ).toBe("x,series_0,series_1\n10,1,4\n20,2,5\n30,3,6");
  });

  it("falls back to index when series have different x arrays", () => {
    expect(
      seriesToCsv([
        { data: [1, 2], x: [10, 20] },
        { data: [3, 4], x: [10, 20] }, // different array reference
      ]),
    ).toBe("index,series_0,series_1\n0,1,3\n1,2,4");
  });

  it("pads short series with empty cells to maxLen", () => {
    expect(seriesToCsv([{ data: [1, 2, 3] }, { data: [4] }])).toBe(
      "index,series_0,series_1\n0,1,4\n1,2,\n2,3,",
    );
  });

  it("works with typed arrays", () => {
    const x = new Float64Array([0, 1, 2]);
    const y = new Float64Array([10, 20, 30]);
    expect(seriesToCsv([{ data: y, x }])).toBe("x,value\n0,10\n1,20\n2,30");
  });
});

describe("categoricalToCsv", () => {
  it("returns empty string for no series or no categories", () => {
    expect(categoricalToCsv([], [{ data: [1] }])).toBe("");
    expect(categoricalToCsv(["A"], [])).toBe("");
  });

  it("emits single-series CSV with `value` header by default", () => {
    expect(categoricalToCsv(["A", "B"], [{ data: [10, 20] }])).toBe(
      "category,value\nA,10\nB,20",
    );
  });

  it("uses the series label as the value column when provided", () => {
    expect(
      categoricalToCsv(["A", "B"], [{ data: [10, 20], label: "cases" }]),
    ).toBe("category,cases\nA,10\nB,20");
  });

  it("emits multi-series CSV with labels or series_N fallback", () => {
    expect(
      categoricalToCsv(
        ["A", "B"],
        [
          { data: [1, 2], label: "low" },
          { data: [3, 4] }, // no label → series_1
        ],
      ),
    ).toBe("category,low,series_1\nA,1,3\nB,2,4");
  });

  it("escapes category values containing commas, quotes, or newlines", () => {
    const csv = categoricalToCsv(
      ["Hello, world", 'She said "hi"', "line\nbreak"],
      [{ data: [1, 2, 3] }],
    );
    expect(csv).toContain('"Hello, world",1');
    expect(csv).toContain('"She said ""hi""",2');
    expect(csv).toContain('"line\nbreak",3');
  });

  it("respects a custom category header", () => {
    expect(categoricalToCsv(["A"], [{ data: [1] }], "day")).toBe(
      "day,value\nA,1",
    );
  });

  it("pads short series with empty cells", () => {
    expect(
      categoricalToCsv(["A", "B", "C"], [{ data: [1, 2], label: "x" }]),
    ).toBe("category,x\nA,1\nB,2\nC,");
  });
});
