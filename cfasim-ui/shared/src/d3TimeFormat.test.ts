import { describe, it, expect } from "vitest";
import { d3TimeFormat } from "./d3TimeFormat.js";

// Expected strings are d3-time-format 4.1.0's output; a differential
// script checked every directive against it, in UTC and in DST zones.
describe("d3TimeFormat", () => {
  const t = Date.UTC(2026, 0, 4, 15, 7, 9, 42); // Sunday Jan 4 2026

  it.each([
    ["%b %d, %Y", "Jan 04, 2026"],
    ["%a %-d %B", "Sun 4 January"],
    ["%e|%_m|%0e", " 4| 1|04"],
    ["%I:%M:%S.%L %p", "03:07:09.042 PM"],
    ["%H%M %Z", "1507 +0000"],
    ["%j %U %W %u %w", "004 01 00 7 0"],
    ["%c", "1/4/2026, 3:07:09 PM"],
    ["%q %y", "1 26"],
    ["%s %Q", "1767539229 1767539229042"],
    ["100%% %k", "100% k"],
  ])("formats %j", (spec, expected) => {
    expect(d3TimeFormat(spec)(t)).toBe(expected);
  });

  it("names ISO weeks and their years across a year boundary", () => {
    const iso = d3TimeFormat("%G-W%V");
    expect(iso(Date.UTC(2026, 0, 1))).toBe("2026-W01"); // Thursday
    expect(iso(Date.UTC(2027, 0, 1))).toBe("2026-W53"); // Friday
    expect(iso(Date.UTC(2024, 11, 30))).toBe("2025-W01"); // Monday
  });

  it("accepts a Date and formats in local time on request", () => {
    const local = d3TimeFormat("%Y-%m-%d %H:%M", { timezone: "local" });
    const d = new Date(2026, 6, 4, 9, 30);
    expect(local(d)).toBe("2026-07-04 09:30");
  });

  it("prints an invalid date's names as empty, as d3 does", () => {
    expect(d3TimeFormat("%a %A %b %B|%d")(NaN)).toBe("   |NaN");
  });
});
