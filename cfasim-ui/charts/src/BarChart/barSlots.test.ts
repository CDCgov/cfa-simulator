import { describe, it, expect } from "vitest";
import {
  addPeriod,
  buildBarSlots,
  reindexToSlots,
  slotIndexAt,
  slotIndexMap,
} from "./barSlots.js";

const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

describe("buildBarSlots", () => {
  it("centers bars on their x with the smallest gap as the width", () => {
    const slots = buildBarSlots([{ x: [0, 2, 3] }], {
      isDate: false,
      tz: "utc",
    });
    expect(slots.x).toEqual([0, 2, 3]);
    expect(slots.start).toEqual([-0.5, 1.5, 2.5]);
    expect(slots.end).toEqual([0.5, 2.5, 3.5]);
    expect(slots.explicit).toEqual([false, false, false]);
  });

  it("uses one unit, or one day on a date axis, for a single x", () => {
    expect(
      buildBarSlots([{ x: [4] }], { isDate: false, tz: "utc" }),
    ).toMatchObject({ start: [3.5], end: [4.5] });
    const d = utc(2026, 1, 5);
    expect(
      buildBarSlots([{ x: [d] }], { isDate: true, tz: "utc" }),
    ).toMatchObject({
      start: [d - DAY / 2],
      end: [d + DAY / 2],
    });
  });

  it("spans [x, x + period) for a numeric period", () => {
    const slots = buildBarSlots([{ x: [0, 10] }], {
      period: 5,
      isDate: false,
      tz: "utc",
    });
    expect(slots.start).toEqual([0, 10]);
    expect(slots.end).toEqual([5, 15]);
    expect(slots.explicit).toEqual([true, true]);
  });

  it("follows month lengths for a calendar period", () => {
    const jan = utc(2026, 1, 1);
    const feb = utc(2026, 2, 1);
    const slots = buildBarSlots([{ x: [jan, feb] }], {
      period: "month",
      isDate: true,
      tz: "utc",
    });
    expect(slots.end).toEqual([feb, utc(2026, 3, 1)]);
    expect((slots.end[0] - slots.start[0]) / DAY).toBe(31);
    expect((slots.end[1] - slots.start[1]) / DAY).toBe(28);
  });

  it("ignores a calendar period off a date axis", () => {
    const slots = buildBarSlots([{ x: [0, 1] }], {
      period: "week",
      isDate: false,
      tz: "utc",
    });
    expect(slots.explicit).toEqual([false, false]);
    expect(slots.end).toEqual([0.5, 1.5]);
  });

  it("takes x2 over period, in either order", () => {
    const slots = buildBarSlots([{ x: [0, 10], x2: [4, 6] }], {
      period: 1,
      isDate: false,
      tz: "utc",
    });
    expect(slots.start).toEqual([0, 6]);
    expect(slots.end).toEqual([4, 10]);
  });

  it("merges every series' x into one sorted set of slots", () => {
    const slots = buildBarSlots([{ x: [3, 1] }, { x: [2, 3], x2: [NaN, 5] }], {
      isDate: false,
      tz: "utc",
    });
    expect(slots.x).toEqual([1, 2, 3]);
    // The second series supplies the only finite x2 for x = 3.
    expect(slots.end[2]).toBe(5);
  });
});

describe("addPeriod", () => {
  it("adds calendar units in UTC", () => {
    const d = utc(2026, 1, 31);
    expect(addPeriod(d, "day", true, "utc")).toBe(utc(2026, 2, 1));
    expect(addPeriod(d, "week", true, "utc")).toBe(utc(2026, 2, 7));
    expect(addPeriod(utc(2026, 1, 1), "quarter", true, "utc")).toBe(
      utc(2026, 4, 1),
    );
    expect(addPeriod(utc(2026, 1, 1), "year", true, "utc")).toBe(
      utc(2027, 1, 1),
    );
  });
});

describe("reindexToSlots", () => {
  it("places values at their slot and leaves the rest NaN", () => {
    const slots = buildBarSlots([{ x: [0, 1, 2] }], {
      isDate: false,
      tz: "utc",
    });
    const out = reindexToSlots([7, 9], [2, 0], slotIndexMap(slots), 3);
    expect(Array.from(out)).toEqual([9, NaN, 7]);
  });
});

describe("slotIndexAt", () => {
  const slots = buildBarSlots([{ x: [0, 10, 20] }], {
    period: 5,
    isDate: false,
    tz: "utc",
  });

  it("finds the slot whose span holds the value", () => {
    expect(slotIndexAt(slots, 0)).toBe(0);
    expect(slotIndexAt(slots, 12)).toBe(1);
    expect(slotIndexAt(slots, 24.9)).toBe(2);
  });

  it("falls back to the nearest center between spans", () => {
    expect(slotIndexAt(slots, 8)).toBe(1);
    expect(slotIndexAt(slots, 6)).toBe(0);
    expect(slotIndexAt(slots, -50)).toBe(0);
    expect(slotIndexAt(slots, 99)).toBe(2);
  });

  it("returns null with no slots or a non-finite value", () => {
    expect(slotIndexAt(slots, NaN)).toBeNull();
    expect(
      slotIndexAt(buildBarSlots([], { isDate: false, tz: "utc" }), 1),
    ).toBeNull();
  });
});
