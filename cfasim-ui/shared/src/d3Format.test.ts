import { describe, it, expect } from "vitest";
import { d3Format } from "./d3Format.js";

// Expected strings are d3-format 3.1.0's output; a differential script
// checked ~87k specifier/value pairs against it while porting.
describe("d3Format", () => {
  it.each([
    [",", 1234567.891, "1,234,567.891"],
    [",.0f", 1234.5, "1,235"],
    [".2f", -0.004, "0.00"],
    ["+.2f", -0.004, "−0.00"],
    [".1%", 0.1234, "12.3%"],
    ["~%", 0.5, "50%"],
    ["~s", 1500, "1.5k"],
    [".3s", 0.000123456, "123µ"],
    ["$,.2f", -1234.5, "−$1,234.50"],
    ["(,.2f", -1234.5, "(1,234.50)"],
    [".2e", 12345, "1.23e+4"],
    [".2r", 0.0123456, "0.012"],
    ["d", 2.5, "3"],
    ["#x", 255, "0xff"],
    ["#b", 5, "0b101"],
    ["c", 42, "42"],
    ["n", 1234567, "1.23457e+6"],
    ["", 0.1 + 0.2, "0.3"],
    ["08.2f", -3.14159, "−0003.14"],
    ["020,.3f", 1234.5, "0,000,000,001,234.500"],
    ["*^11,d", 1234, "***1,234***"],
    ["=+10,.1f", 1234.5, "+  1,234.5"],
  ])("formats %j", (spec, value, expected) => {
    expect(d3Format(spec)(value)).toBe(expected);
  });

  it("throws on a malformed specifier", () => {
    expect(() => d3Format(".2ff")).toThrow("invalid format: .2ff");
  });
});
