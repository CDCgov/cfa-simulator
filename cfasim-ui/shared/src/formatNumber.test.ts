import { describe, it, expect } from "vitest";
import { formatNumber, formatPrintf, isNumberFormat } from "./formatNumber.js";

describe("formatNumber", () => {
  it("returns String(value) when no format is given", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(1.5)).toBe("1.5");
  });

  it("passes non-finite values through unchanged", () => {
    expect(formatNumber(NaN, "percent")).toBe("NaN");
    expect(formatNumber(Infinity, "%.2f")).toBe("Infinity");
    expect(formatNumber(-Infinity, (v) => `x=${v}`)).toBe("-Infinity");
  });

  it("invokes a custom function formatter", () => {
    expect(formatNumber(3, (v) => `n=${v * 2}`)).toBe("n=6");
  });

  describe("presets", () => {
    it("plain returns String(value)", () => {
      expect(formatNumber(1234.5, "plain")).toBe("1234.5");
    });

    it("localized groups thousands", () => {
      // Locale-dependent grouping char; just check there's a separator.
      const out = formatNumber(1234567, "localized");
      expect(out).toMatch(/1.234.567/);
    });

    it("percent multiplies by 100 and appends %", () => {
      expect(formatNumber(0.5, "percent")).toBe("50%");
      expect(formatNumber(0.1234, "percent")).toBe("12.34%");
    });

    it("presets preserve raw precision when no :N is given", () => {
      // Without a digit suffix, these used to round at Intl defaults (~3
      // significant digits). Now they preserve the raw value.
      expect(formatNumber(1234.5678, "localized")).toMatch(/1.234[.,]5678$/);
      expect(formatNumber(0.123456, "percent")).toBe("12.3456%");
      expect(formatNumber(12345, "scientific")).toBe("1.2345E4");
      expect(formatNumber(12345, "engineering")).toBe("12.345E3");
    });

    it("compact uses short forms", () => {
      expect(formatNumber(1500, "compact")).toBe("1.5K");
      expect(formatNumber(2_500_000, "compact")).toBe("2.5M");
    });

    it("scientific uses scientific notation", () => {
      expect(formatNumber(12345, "scientific")).toMatch(/^1\.\d+E4$/);
      expect(formatNumber(0.001, "scientific")).toBe("1E-3");
    });

    it("engineering uses powers of 1000", () => {
      expect(formatNumber(12345, "engineering")).toMatch(/^12\.\d+E3$/);
    });
  });

  describe("preset:digits suffix", () => {
    it("plain:N rounds to N decimal places", () => {
      expect(formatNumber(1.2345, "plain:2")).toBe("1.23");
      expect(formatNumber(1, "plain:0")).toBe("1");
    });

    it("localized:N pads/truncates fractional digits", () => {
      expect(formatNumber(1234.5, "localized:2")).toBe("1,234.50");
      expect(formatNumber(1234.567, "localized:0")).toBe("1,235");
    });

    it("percent:N controls fraction digits", () => {
      expect(formatNumber(0.1234, "percent:1")).toBe("12.3%");
      expect(formatNumber(0.5, "percent:0")).toBe("50%");
      expect(formatNumber(0.5, "percent:2")).toBe("50.00%");
    });

    it("compact:N controls fraction digits", () => {
      expect(formatNumber(1500, "compact:2")).toBe("1.50K");
      expect(formatNumber(1500, "compact:0")).toBe("2K");
    });

    it("scientific:N controls fraction digits", () => {
      expect(formatNumber(12345, "scientific:2")).toBe("1.23E4");
    });

    it("engineering:N controls fraction digits", () => {
      expect(formatNumber(12345, "engineering:1")).toBe("12.3E3");
    });

    it("throws on malformed :suffix", () => {
      expect(() => formatNumber(42, "percent:abc")).toThrow(/invalid format/);
      expect(() => formatNumber(42, "compact:")).toThrow(/invalid format/);
      expect(() => formatNumber(42, "percent:1.5")).toThrow(/invalid format/);
    });

    it("throws on unknown preset names", () => {
      expect(() => formatNumber(42, "bogus")).toThrow(/invalid format/);
    });
  });

  describe("printf strings", () => {
    it("formats with %f", () => {
      expect(formatNumber(3.14159, "%.2f")).toBe("3.14");
    });

    it("formats with %d", () => {
      expect(formatNumber(42, "%05d")).toBe("00042");
    });

    it("supports compound printf strings", () => {
      expect(formatNumber(0.42, "rate: %.1f")).toBe("rate: 0.4");
    });

    it("treats any string with % as printf (skips preset parsing)", () => {
      // Even though "percent" is a preset name, a `%` placeholder anywhere
      // routes through printf instead.
      expect(formatNumber(42, "percent %d")).toBe("percent 42");
    });
  });
});

describe("formatPrintf", () => {
  it("matches sprintf-js for the common conversions", () => {
    expect(formatPrintf("%d", 3.7)).toBe("3");
    expect(formatPrintf("%i", -3.7)).toBe("-3");
    expect(formatPrintf("%d", -0.4)).toBe("0");
    expect(formatPrintf("%05d", -0.4)).toBe("00000");
    expect(formatPrintf("%.0f", -0.4)).toBe("-0");
    expect(formatPrintf("%f", 1.5)).toBe("1.5");
    expect(formatPrintf("%.3f", 2)).toBe("2.000");
    expect(formatPrintf("%.1f", -0.25)).toBe("-0.3");
    expect(formatPrintf("%e", 12345)).toBe("1.2345e+4");
    expect(formatPrintf("%.2E", 12345)).toBe("1.23E+4");
    expect(formatPrintf("%.3g", 1234.5)).toBe("1230");
    expect(formatPrintf("%.3g", 0.5)).toBe("0.5");
    expect(formatPrintf("%.2f", -0)).toBe("0.00");
    expect(formatPrintf("%s", 0.5)).toBe("0.5");
  });

  it("applies width, zero padding and alignment flags", () => {
    expect(formatPrintf("%5d", 42)).toBe("   42");
    expect(formatPrintf("%-5d|", 42)).toBe("42   |");
    expect(formatPrintf("%05d", -42)).toBe("-0042");
    expect(formatPrintf("%+d", 42)).toBe("+42");
    expect(formatPrintf("% d", 42)).toBe(" 42");
    expect(formatPrintf("%08.2f", 3.14159)).toBe("00003.14");
    expect(formatPrintf("%6.1f%%", 12.34)).toBe("  12.3%");
  });

  it("keeps literal text and fills every placeholder", () => {
    expect(formatPrintf("x = %.1f (%d)", 2.55)).toBe("x = 2.5 (2)");
    expect(formatPrintf("100%%", 1)).toBe("100%");
    expect(formatPrintf("no placeholder", 1)).toBe("no placeholder");
  });

  it("throws on conversions outside the supported subset", () => {
    expect(() => formatPrintf("%x", 255)).toThrow(/unsupported printf/);
    expect(() => formatNumber(255, "%08b")).toThrow(/"%b"/);
  });

  it("throws on a % that is not a placeholder", () => {
    expect(() => formatNumber(42, "50%")).toThrow(/malformed printf/);
    expect(() => formatNumber(42, "%.2 f")).toThrow(/malformed printf/);
    expect(() => formatNumber(42, "%'*5d")).toThrow(/malformed printf/);
    expect(() => formatNumber(5, "%1$d")).toThrow(/malformed printf/);
  });

  it("applies precision and zero padding to %s like sprintf-js", () => {
    expect(formatPrintf("%.2s", 123.456)).toBe("12");
    expect(formatPrintf("%05s|", 7)).toBe("00007|");
  });
});

describe("isNumberFormat", () => {
  it("accepts strings and functions", () => {
    expect(isNumberFormat("percent")).toBe(true);
    expect(isNumberFormat("%.2f")).toBe(true);
    expect(isNumberFormat((v: number) => String(v))).toBe(true);
  });

  it("rejects other types", () => {
    expect(isNumberFormat(undefined)).toBe(false);
    expect(isNumberFormat(null)).toBe(false);
    expect(isNumberFormat(42)).toBe(false);
    expect(isNumberFormat({})).toBe(false);
  });
});
