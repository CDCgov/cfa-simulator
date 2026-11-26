import { describe, it, expect } from "vitest";
import { formatDate, parseDate } from "./dateFormat";

describe("dateFormat", () => {
  it("parses default, custom, unpadded, and month-name formats", () => {
    const target = { year: 2026, month: 5, day: 4 };
    expect(parseDate(" 2026-5-4 ")).toEqual(target);
    expect(parseDate("05/04/2026", "mm/dd/yyyy")).toEqual(target);
    expect(parseDate("04.05.26", "DD.MM.YY")).toEqual(target);
    expect(parseDate("Sep 3, 2026", "mmm d, yyyy")).toEqual({
      year: 2026,
      month: 9,
      day: 3,
    });
    expect(parseDate("september 3,  2026", "mmmm d, yyyy")).toEqual({
      year: 2026,
      month: 9,
      day: 3,
    });
    expect(parseDate("Sept 3, 2026", "mmm d, yyyy")).toBeNull();
  });

  it("rejects invalid dates and escapes regex literals", () => {
    expect(parseDate("2026-02-29")).toBeNull();
    expect(parseDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("2026.05.14", "yyyy-mm-dd")).toBeNull();
    expect(parseDate("2026x05x14", "yyyy.mm.dd")).toBeNull();
  });

  it("formats and round-trips across token patterns", () => {
    const date = { year: 2026, month: 5, day: 4 };
    for (const fmt of ["yyyy-mm-dd", "dd/mm/yyyy", "mmm d, yyyy", "yy.m.d"]) {
      expect(parseDate(formatDate(date, fmt), fmt)).toEqual(date);
    }
  });
});
