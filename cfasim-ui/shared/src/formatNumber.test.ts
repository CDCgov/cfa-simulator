import { describe, it, expect } from "vitest";
import { formatNumber, formatPrintf, isNumberFormat } from "./formatNumber.js";

describe("formatNumber", () => {
  it("handles defaults, custom functions, non-finite, and missing values", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(3, (value) => `n=${value * 2}`)).toBe("n=6");
    expect(formatNumber(NaN, "percent")).toBe("NaN");
    expect(formatNumber(Infinity, "%.2f")).toBe("Infinity");
    expect(formatNumber(null, "percent")).toBe("");
    expect(formatNumber(undefined)).toBe("");

    const dash = { missing: "–" };
    expect(formatNumber(NaN, "percent", dash)).toBe("–");
    expect(formatNumber(null, (value) => `x=${value}`, dash)).toBe("–");
    expect(formatNumber(Infinity, "plain", dash)).toBe("Infinity");
    expect(formatNumber(0, "plain", dash)).toBe("0");
  });

  it("formats presets with raw precision, :N suffixes, and rejects invalid formats", () => {
    expect(formatNumber(1.2345, "plain:2")).toBe("1.23");
    expect(formatNumber(1234.5678, "localized")).toMatch(/1.234[.,]5678$/);
    expect(formatNumber(1234.5, "localized:2")).toBe("1,234.50");
    expect(formatNumber(0.123456, "percent")).toBe("12.3456%");
    expect(formatNumber(0.1234, "percent:1")).toBe("12.3%");
    expect(formatNumber(1500, "compact")).toBe("1.5K");
    expect(formatNumber(1500, "compact:2")).toBe("1.50K");
    expect(formatNumber(12345, "scientific")).toBe("1.2345E4");
    expect(formatNumber(12345, "scientific:2")).toBe("1.23E4");
    expect(formatNumber(12345, "engineering:1")).toBe("12.3E3");

    expect(() => formatNumber(42, "percent:abc")).toThrow(/invalid format/);
    expect(() => formatNumber(42, "bogus")).toThrow(/invalid format/);
    expect(formatNumber(42, "percent %d")).toBe("percent 42");
  });
});

describe("formatPrintf / isNumberFormat", () => {
  it("handles printf conversions, flags, errors, and type guard", () => {
    expect(formatPrintf("%d", -0.4)).toBe("0");
    expect(formatPrintf("%05d", -42)).toBe("-0042");
    expect(formatPrintf("%-5d|", 42)).toBe("42   |");
    expect(formatPrintf("%.0f", -0.4)).toBe("-0");
    expect(formatPrintf("%.2f", -0)).toBe("0.00");
    expect(formatPrintf("%.2E", 12345)).toBe("1.23E+4");
    expect(formatPrintf("%.3g", 1234.5)).toBe("1230");
    expect(formatPrintf("%.2s", 123.456)).toBe("12");
    expect(formatPrintf("x = %.1f (%d) 100%%", 2.55)).toBe("x = 2.5 (2) 100%");

    expect(() => formatPrintf("%x", 255)).toThrow(/unsupported printf/);
    expect(() => formatNumber(42, "50%")).toThrow(/malformed printf/);
    expect(() => formatNumber(5, "%1$d")).toThrow(/malformed printf/);
    expect(isNumberFormat("percent")).toBe(true);
    expect(isNumberFormat((value: number) => String(value))).toBe(true);
    expect(isNumberFormat(42)).toBe(false);
  });
});
