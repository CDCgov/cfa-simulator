import { describe, it, expect } from "vitest";
import {
  parseDate,
  isDateLike,
  isAllDates,
  pickDateTicks,
  formatDate,
  DATE_FORMAT_PRESETS,
} from "./dateAxis.js";

describe("parseDate", () => {
  it("accepts Date instances", () => {
    const d = new Date(Date.UTC(2026, 0, 15));
    expect(parseDate(d, "utc")).toBe(d.getTime());
  });

  it("rejects invalid Date instances", () => {
    expect(parseDate(new Date("not a date"), "utc")).toBeNull();
  });

  it("parses YYYY-MM-DD as midnight UTC under utc mode", () => {
    expect(parseDate("2026-01-15", "utc")).toBe(Date.UTC(2026, 0, 15));
  });

  it("parses YYYY-MM-DD as midnight local under local mode", () => {
    expect(parseDate("2026-01-15", "local")).toBe(
      new Date(2026, 0, 15).getTime(),
    );
  });

  it("parses ISO datetime with Z as UTC regardless of tz prop", () => {
    const utc = parseDate("2026-01-15T12:00:00Z", "utc");
    const local = parseDate("2026-01-15T12:00:00Z", "local");
    expect(utc).toBe(local);
    expect(utc).toBe(Date.UTC(2026, 0, 15, 12, 0, 0));
  });

  it("parses ISO datetime with +HH:MM offset", () => {
    expect(parseDate("2026-01-15T12:00:00+05:00", "utc")).toBe(
      Date.UTC(2026, 0, 15, 7, 0, 0),
    );
  });

  it("parses ISO datetime without offset per tz prop", () => {
    expect(parseDate("2026-01-15T12:00:00", "utc")).toBe(
      Date.UTC(2026, 0, 15, 12, 0, 0),
    );
    expect(parseDate("2026-01-15T12:00:00", "local")).toBe(
      new Date(2026, 0, 15, 12, 0, 0).getTime(),
    );
  });

  it("parses sub-second milliseconds", () => {
    expect(parseDate("2026-01-15T12:00:00.250Z", "utc")).toBe(
      Date.UTC(2026, 0, 15, 12, 0, 0, 250),
    );
  });

  it("rejects plain numbers", () => {
    expect(parseDate(1737504000000, "utc")).toBeNull();
    expect(parseDate(0, "utc")).toBeNull();
  });

  it("rejects malformed strings", () => {
    expect(parseDate("2026/01/15", "utc")).toBeNull();
    expect(parseDate("not a date", "utc")).toBeNull();
    expect(parseDate("2026-13-01", "utc")).not.toBeNull(); // month overflow ok
    expect(parseDate("", "utc")).toBeNull();
  });

  it("handles pre-1970 dates", () => {
    expect(parseDate("1900-01-01", "utc")).toBe(Date.UTC(1900, 0, 1));
  });
});

describe("isDateLike", () => {
  it("accepts Date instances and ISO strings", () => {
    expect(isDateLike(new Date())).toBe(true);
    expect(isDateLike("2026-01-15")).toBe(true);
    expect(isDateLike("2026-01-15T12:00:00Z")).toBe(true);
  });

  it("rejects plain numbers and non-ISO strings", () => {
    expect(isDateLike(42)).toBe(false);
    expect(isDateLike(1737504000000)).toBe(false);
    expect(isDateLike("42")).toBe(false);
    expect(isDateLike("2024")).toBe(false);
    expect(isDateLike("Jan 15, 2026")).toBe(false);
    expect(isDateLike(null)).toBe(false);
    expect(isDateLike(undefined)).toBe(false);
  });
});

describe("isAllDates", () => {
  it("returns true when every entry is date-like", () => {
    expect(isAllDates(["2026-01-15", "2026-01-22", new Date()], "utc")).toBe(
      true,
    );
  });

  it("returns false on mixed input with plain numbers", () => {
    expect(isAllDates(["2026-01-15", 1737504000000], "utc")).toBe(false);
  });

  it("returns false for empty arrays", () => {
    expect(isAllDates([], "utc")).toBe(false);
  });
});

describe("pickDateTicks", () => {
  const target = 5;

  it("returns empty values for invalid ranges", () => {
    const r = pickDateTicks(0, 0, target, "utc");
    expect(r.values).toEqual([]);
  });

  it("picks daily ticks for a 3-day span", () => {
    const min = Date.UTC(2026, 0, 10);
    const max = Date.UTC(2026, 0, 13);
    const r = pickDateTicks(min, max, target, "utc");
    expect(r.unit).toBe("day");
    expect(r.values).toEqual([
      Date.UTC(2026, 0, 10),
      Date.UTC(2026, 0, 11),
      Date.UTC(2026, 0, 12),
      Date.UTC(2026, 0, 13),
    ]);
  });

  it("picks weekly ticks for a multi-week span (Monday-anchored)", () => {
    const min = Date.UTC(2026, 0, 1); // Thursday
    const max = Date.UTC(2026, 1, 5);
    const r = pickDateTicks(min, max, target, "utc");
    expect(r.unit).toBe("week");
    // Every value should be a Monday in UTC.
    for (const v of r.values) {
      expect(new Date(v).getUTCDay()).toBe(1);
    }
    expect(r.values.length).toBeGreaterThan(2);
  });

  it("picks monthly ticks for a 6-month span", () => {
    const min = Date.UTC(2026, 0, 5);
    const max = Date.UTC(2026, 5, 20);
    const r = pickDateTicks(min, max, target, "utc");
    expect(r.unit).toBe("month");
    for (const v of r.values) {
      const d = new Date(v);
      expect(d.getUTCDate()).toBe(1);
    }
  });

  it("picks yearly ticks for a 10-year span using a locked step set", () => {
    const min = Date.UTC(2020, 0, 1);
    const max = Date.UTC(2030, 0, 1);
    const r = pickDateTicks(min, max, target, "utc");
    expect(r.unit).toBe("year");
    // Step must come from {1,2,5,10,25,50,100}.
    const step =
      r.values.length > 1
        ? new Date(r.values[1]).getUTCFullYear() -
          new Date(r.values[0]).getUTCFullYear()
        : 0;
    expect([1, 2, 5, 10, 25, 50, 100]).toContain(step);
  });

  it("handles pre-1970 ranges", () => {
    const min = Date.UTC(1900, 0, 1);
    const max = Date.UTC(1920, 0, 1);
    const r = pickDateTicks(min, max, target, "utc");
    expect(r.unit).toBe("year");
    expect(r.values.length).toBeGreaterThan(0);
    expect(r.values[0]).toBeLessThan(0);
  });

  it("picks minute ticks for a 1-hour span", () => {
    const min = Date.UTC(2026, 0, 15, 12, 0);
    const max = Date.UTC(2026, 0, 15, 13, 0);
    const r = pickDateTicks(min, max, target, "utc");
    expect(r.unit).toBe("minute");
    expect(r.values.length).toBeGreaterThan(2);
    expect(r.values.length).toBeLessThan(7);
  });

  it("picks hour ticks for a 1-day span", () => {
    const min = Date.UTC(2026, 0, 15);
    const max = Date.UTC(2026, 0, 16);
    const r = pickDateTicks(min, max, target, "utc");
    expect(r.unit).toBe("hour");
    expect(r.values.length).toBeGreaterThan(2);
    expect(r.values.length).toBeLessThan(7);
  });

  it("anchors day ticks at midnight in local mode (DST-safe)", () => {
    // Span crossing US DST (March 2026: DST starts March 8). Local day
    // stepping must land on 00:00 local time, not 23:00 or 01:00.
    const min = new Date(2026, 2, 5).getTime();
    const max = new Date(2026, 2, 12).getTime();
    const r = pickDateTicks(min, max, target, "local");
    expect(r.unit).toBe("day");
    for (const v of r.values) {
      const d = new Date(v);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    }
  });
});

describe("formatDate", () => {
  const ms = Date.UTC(2026, 0, 15, 12, 30, 45);

  it("'iso' preset emits YYYY-MM-DD", () => {
    expect(formatDate(ms, "iso", "utc")).toBe("2026-01-15");
  });

  it("'iso-datetime' preset emits full ISO with Z under utc", () => {
    expect(formatDate(ms, "iso-datetime", "utc")).toBe("2026-01-15T12:30:45Z");
  });

  it("'year' preset emits 4-digit year", () => {
    expect(formatDate(ms, "year", "utc")).toBe("2026");
  });

  it("'month-day' preset includes month and day", () => {
    const s = formatDate(ms, "month-day", "utc");
    expect(s).toContain("Jan");
    expect(s).toContain("15");
  });

  it("function format receives ms and unit", () => {
    const captured: Array<{ ms: number; unit?: string }> = [];
    formatDate(
      ms,
      (m, u) => {
        captured.push({ ms: m, unit: u });
        return "x";
      },
      "utc",
      "month",
    );
    expect(captured).toEqual([{ ms, unit: "month" }]);
  });

  it("Intl.DateTimeFormatOptions passthrough is honored", () => {
    const s = formatDate(ms, { year: "numeric", month: "numeric" }, "utc");
    // Don't assert the exact rendering (locale-dependent), just that
    // it includes the year.
    expect(s).toContain("2026");
  });

  it("default format uses unit-appropriate preset", () => {
    // Year unit → "year" preset
    expect(formatDate(ms, undefined, "utc", "year")).toBe("2026");
    // Month unit → "month-year" preset (includes both)
    const monthOut = formatDate(ms, undefined, "utc", "month");
    expect(monthOut).toContain("Jan");
    expect(monthOut).toContain("2026");
  });

  it("throws on unknown preset names", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => formatDate(ms, "compact" as any, "utc")).toThrow();
  });
});

describe("preset-name disjointness with NumberFormat", () => {
  it("date and number preset names do not overlap", () => {
    // Hardcoded list mirrors formatNumber.ts presets. If new number
    // presets are added that collide with a date preset, update this
    // test and either rename or namespace.
    const NUMBER_PRESETS = [
      "plain",
      "localized",
      "percent",
      "compact",
      "scientific",
      "engineering",
    ];
    for (const date of DATE_FORMAT_PRESETS) {
      expect(NUMBER_PRESETS).not.toContain(date);
    }
  });
});
