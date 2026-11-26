import { describe, it, expect } from "vitest";
import { d3Format } from "./d3Format.js";

describe("d3Format", () => {
  it.each([
    [",.0f", 1234.5, "1,235"],
    ["+.2f", -0.004, "−0.00"],
    [".1%", 0.1234, "12.3%"],
    ["~s", 1500, "1.5k"],
    ["$,.2f", -1234.5, "−$1,234.50"],
    ["(,.2f", -1234.5, "(1,234.50)"],
    [".2e", 12345, "1.23e+4"],
    ["#x", 255, "0xff"],
    ["", 0.1 + 0.2, "0.3"],
    ["08.2f", -3.14159, "−0003.14"],
    ["*^11,d", 1234, "***1,234***"],
  ])("formats %j", (spec, value, expected) => {
    expect(d3Format(spec)(value)).toBe(expected);
  });

  it("throws on malformed specifiers", () => {
    expect(() => d3Format(".2ff")).toThrow("invalid format: .2ff");
  });
});
