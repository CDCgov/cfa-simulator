import { describe, it, expect } from "vitest";
import {
  parseDate,
  isDateLike,
  isAllDates,
  pickDateTicks,
  placedDateTicks,
  unitForInterval,
  formatDate,
  DATE_FORMAT_PRESETS,
} from "./dateAxis.js";

describe("parseDate / isDateLike / isAllDates", () => {
  it("parses Date, YYYY-MM-DD (utc/local), ISO offsets, ms, pre-1970, and rejects non-dates", () => {
    expect(parseDate("2026-01-15", "utc")).toBe(Date.UTC(2026, 0, 15));
    expect(parseDate("2026-01-15", "local")).toBe(
      new Date(2026, 0, 15).getTime(),
    );
    expect(parseDate("2026-01-15T12:00:00Z", "local")).toBe(
      Date.UTC(2026, 0, 15, 12),
    );
    expect(parseDate("2026-01-15T12:00:00+05:00", "utc")).toBe(
      Date.UTC(2026, 0, 15, 7),
    );
    expect(parseDate("2026-01-15T12:00:00.250Z", "utc")).toBe(
      Date.UTC(2026, 0, 15, 12, 0, 0, 250),
    );
    expect(parseDate("1900-01-01", "utc")).toBe(Date.UTC(1900, 0, 1));
    expect(parseDate(new Date("bad"), "utc")).toBeNull();
    expect(parseDate(1737504000000, "utc")).toBeNull();
    expect(parseDate("2026/01/15", "utc")).toBeNull();

    expect(isDateLike("2026-01-15")).toBe(true);
    expect(isDateLike(42)).toBe(false);
    expect(isDateLike("2024")).toBe(false);
    expect(isAllDates(["2026-01-15", new Date()], "utc")).toBe(true);
    expect(isAllDates(["2026-01-15", 1737504000000], "utc")).toBe(false);
    expect(isAllDates([], "utc")).toBe(false);
  });
});

describe("placedDateTicks / pickDateTicks", () => {
  const day = 24 * 60 * 60 * 1000;

  it("places interval and explicit ticks clipped to span and maps units", () => {
    const min = Date.UTC(2026, 4, 14);
    const interval = placedDateTicks(min, min + 20 * day, 7 * day);
    expect(interval.unit).toBe("week");
    expect(interval.values).toEqual([min, min + 7 * day, min + 14 * day]);

    const explicit = placedDateTicks(min, min + 10 * day, [
      min - day,
      min + 2 * day,
      min + 30 * day,
    ]);
    expect(explicit.values).toEqual([min + 2 * day]);
    expect(unitForInterval(day)).toBe("day");
    expect(unitForInterval(90 * day)).toBe("month");
    expect(unitForInterval(400 * day)).toBe("year");
  });

  it("picks appropriate calendar units and steps coarser when a fit predicate rejects", () => {
    expect(pickDateTicks(0, 0, 5, "utc").values).toEqual([]);

    const daily = pickDateTicks(
      Date.UTC(2026, 0, 10),
      Date.UTC(2026, 0, 13),
      5,
      "utc",
    );
    expect(daily.unit).toBe("day");
    expect(daily.values).toHaveLength(4);

    const weekly = pickDateTicks(
      Date.UTC(2026, 0, 1),
      Date.UTC(2026, 1, 5),
      5,
      "utc",
    );
    expect(weekly.unit).toBe("week");
    for (const v of weekly.values) expect(new Date(v).getUTCDay()).toBe(1);

    const monthly = pickDateTicks(
      Date.UTC(2025, 10, 1),
      Date.UTC(2026, 10, 1),
      12,
      "utc",
      (vals) => vals.length <= 8,
    );
    expect(monthly.unit).toBe("month");
    expect(monthly.values).toHaveLength(7);

    const yearly = pickDateTicks(
      Date.UTC(2020, 0, 1),
      Date.UTC(2030, 0, 1),
      5,
      "utc",
    );
    expect(yearly.unit).toBe("year");

    // Local day stepping across US DST must stay anchored at 00:00 local time.
    const dst = pickDateTicks(
      new Date(2026, 2, 5).getTime(),
      new Date(2026, 2, 12).getTime(),
      5,
      "local",
    );
    expect(dst.unit).toBe("day");
    for (const v of dst.values) {
      expect(new Date(v).getHours()).toBe(0);
    }
  });
});

describe("formatDate", () => {
  const ms = Date.UTC(2026, 0, 15, 12, 30, 45);

  it("formats presets, mutated Intl options, custom functions, and rejects unknown presets", () => {
    expect(formatDate(ms, "iso", "utc")).toBe("2026-01-15");
    expect(formatDate(ms, "iso-datetime", "utc")).toBe("2026-01-15T12:30:45Z");
    expect(formatDate(ms, undefined, "utc", "year")).toBe("2026");

    const opts: Intl.DateTimeFormatOptions = { year: "numeric" };
    expect(formatDate(ms, opts, "utc")).toBe("2026");
    opts.month = "short";
    expect(formatDate(ms, opts, "utc")).toContain("Jan");

    expect(
      formatDate(ms, (value, unit) => `${value}:${unit}`, "utc", "month"),
    ).toBe(`${ms}:month`);
    expect(() => formatDate(ms, "compact" as never, "utc")).toThrow();

    const numberPresets = [
      "plain",
      "localized",
      "percent",
      "compact",
      "scientific",
      "engineering",
    ];
    for (const preset of DATE_FORMAT_PRESETS)
      expect(numberPresets).not.toContain(preset);
  });
});
