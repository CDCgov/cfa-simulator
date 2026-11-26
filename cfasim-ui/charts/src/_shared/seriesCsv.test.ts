import { describe, it, expect } from "vitest";
import { seriesToCsv, categoricalToCsv } from "./seriesCsv.js";

describe("seriesToCsv", () => {
  it("formats headers, shared x column, typed arrays, padding, and empty input", () => {
    expect(seriesToCsv([])).toBe("");
    expect(seriesToCsv([{ data: [10, 20] }])).toBe("index,value\n0,10\n1,20");
    expect(seriesToCsv([{ data: [1, 2], label: "Cases" }, { data: [3] }])).toBe(
      "index,Cases,series_1\n0,1,3\n1,2,",
    );

    const sharedX = new Float64Array([10, 20]);
    expect(
      seriesToCsv([
        { data: new Float64Array([1, 2]), x: sharedX },
        { data: [3, 4], x: sharedX },
      ]),
    ).toBe("x,series_0,series_1\n10,1,3\n20,2,4");
    // Distinct x array references fall back to index.
    expect(
      seriesToCsv([
        { data: [1], x: [10] },
        { data: [2], x: [10] },
      ]),
    ).toBe("index,series_0,series_1\n0,1,2");
  });

  it("escapes commas, deduplicates colliding headers, and appends lower/upper bounds", () => {
    expect(
      seriesToCsv([
        { data: [1], label: "Cases, weekly", lower: [0], upper: [2] },
        { data: [5], label: "Cases, weekly", lower: [4], upper: [6] },
        { data: [9], label: "index" },
      ]),
    ).toBe(
      'index,"Cases, weekly","Cases, weekly_lower","Cases, weekly_upper","Cases, weekly_2","Cases, weekly_2_lower","Cases, weekly_2_upper",index_2\n0,1,0,2,5,4,6,9',
    );
    expect(seriesToCsv([{ data: [1], lower: [0] }])).toBe("index,value\n0,1");
  });
});

describe("categoricalToCsv", () => {
  it("escapes categories and headers, deduplicates labels, and includes interval bounds", () => {
    expect(categoricalToCsv([], [{ data: [1] }])).toBe("");
    expect(
      categoricalToCsv(
        ["Hello, world", 'She said "hi"', "line\nbreak"],
        [{ data: [1, 2], label: "category", lower: [0, 1], upper: [2, 3] }],
      ),
    ).toBe(
      'category,category_2,category_2_lower,category_2_upper\n"Hello, world",1,0,2\n"She said ""hi""",2,1,3\n"line\nbreak",,,',
    );
    expect(
      categoricalToCsv(["A"], [{ data: [1] }], "Age, yrs", [
        { header: "end", values: ["B"] },
      ]),
    ).toBe('"Age, yrs",end,value\nA,B,1');
  });
});
