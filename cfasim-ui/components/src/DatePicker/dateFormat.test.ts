import { describe, it, expect } from "vitest";
import { formatDate, parseDate } from "./dateFormat";

describe("parseDate", () => {
  it("parses the default yyyy-mm-dd format", () => {
    expect(parseDate("2026-05-14")).toEqual({ year: 2026, month: 5, day: 14 });
  });

  it("accepts unpadded numbers and surrounding whitespace", () => {
    expect(parseDate(" 2026-5-4 ")).toEqual({ year: 2026, month: 5, day: 4 });
  });

  it("parses custom formats", () => {
    expect(parseDate("05/14/2026", "mm/dd/yyyy")).toEqual({
      year: 2026,
      month: 5,
      day: 14,
    });
    expect(parseDate("14.05.26", "DD.MM.YY")).toEqual({
      year: 2026,
      month: 5,
      day: 14,
    });
  });

  it("parses month names case-insensitively", () => {
    const want = { year: 2026, month: 9, day: 3 };
    expect(parseDate("Sep 3, 2026", "mmm d, yyyy")).toEqual(want);
    expect(parseDate("september 3,  2026", "mmmm d, yyyy")).toEqual(want);
    expect(parseDate("Sept 3, 2026", "mmm d, yyyy")).toBeNull();
  });

  it("rejects input that does not match or is not a real date", () => {
    expect(parseDate("05/14/2026")).toBeNull();
    expect(parseDate("2026-02-29")).toBeNull();
    expect(parseDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("2026-00-10")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("escapes regex characters in literals", () => {
    expect(parseDate("2026.05.14", "yyyy-mm-dd")).toBeNull();
    expect(parseDate("2026.05.14", "yyyy.mm.dd")).not.toBeNull();
    expect(parseDate("2026x05x14", "yyyy.mm.dd")).toBeNull();
  });
});

describe("formatDate", () => {
  const d = { year: 2026, month: 5, day: 4 };

  it("formats each token", () => {
    expect(formatDate(d)).toBe("2026-05-04");
    expect(formatDate(d, "m/d/yy")).toBe("5/4/26");
    expect(formatDate(d, "mmmm d, yyyy")).toBe("May 4, 2026");
    expect(formatDate({ ...d, month: 1 }, "dd mmm yyyy")).toBe("04 Jan 2026");
  });

  it("round-trips with parseDate", () => {
    for (const f of ["yyyy-mm-dd", "dd/mm/yyyy", "mmm d, yyyy", "yy.m.d"]) {
      expect(parseDate(formatDate(d, f), f)).toEqual(d);
    }
  });
});
