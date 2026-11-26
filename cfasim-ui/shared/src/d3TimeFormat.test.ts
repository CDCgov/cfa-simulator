import { describe, it, expect } from "vitest";
import { d3TimeFormat } from "./d3TimeFormat.js";

describe("d3TimeFormat", () => {
  const timestamp = Date.UTC(2026, 0, 4, 15, 7, 9, 42);

  it.each([
    ["%b %d, %Y", "Jan 04, 2026"],
    ["%a %-d %B", "Sun 4 January"],
    ["%I:%M:%S.%L %p %Z", "03:07:09.042 PM +0000"],
    ["%j %U %W %u %w", "004 01 00 7 0"],
    ["%q %s %Q 100%%", "1 1767539229 1767539229042 100%"],
  ])("formats %j", (spec, expected) => {
    expect(d3TimeFormat(spec)(timestamp)).toBe(expected);
  });

  it("handles ISO week boundaries, local timezone, and invalid dates", () => {
    const iso = d3TimeFormat("%G-W%V");
    expect(iso(Date.UTC(2026, 0, 1))).toBe("2026-W01");
    expect(iso(Date.UTC(2027, 0, 1))).toBe("2026-W53");
    expect(iso(Date.UTC(2024, 11, 30))).toBe("2025-W01");
    expect(
      d3TimeFormat("%Y-%m-%d %H:%M", { timezone: "local" })(
        new Date(2026, 6, 4, 9, 30),
      ),
    ).toBe("2026-07-04 09:30");
    expect(d3TimeFormat("%a %A %b %B|%d")(NaN)).toBe("   |NaN");
  });
});
