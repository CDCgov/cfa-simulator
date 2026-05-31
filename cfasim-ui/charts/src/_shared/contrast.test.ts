import { describe, it, expect } from "vitest";
import { parseRgb, relativeLuminance, pickContrastColor } from "./contrast.js";

describe("parseRgb", () => {
  it("parses 6-digit hex", () => {
    expect(parseRgb("#3b82f6")).toEqual([59, 130, 246]);
  });
  it("parses 3-digit hex", () => {
    expect(parseRgb("#fff")).toEqual([255, 255, 255]);
    expect(parseRgb("#000")).toEqual([0, 0, 0]);
  });
  it("ignores alpha in 8/4-digit hex", () => {
    expect(parseRgb("#3b82f680")).toEqual([59, 130, 246]);
    expect(parseRgb("#fff8")).toEqual([255, 255, 255]);
  });
  it("parses rgb() and rgba()", () => {
    expect(parseRgb("rgb(10, 20, 30)")).toEqual([10, 20, 30]);
    expect(parseRgb("rgba(10,20,30,0.5)")).toEqual([10, 20, 30]);
    expect(parseRgb("rgb(100% 0% 50%)")).toEqual([255, 0, 128]);
  });
  it("returns null for unresolvable forms", () => {
    expect(parseRgb("rebeccapurple")).toBeNull();
    expect(parseRgb("var(--x, #fff)")).toBeNull();
    expect(parseRgb("#xyz")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });
});

describe("pickContrastColor", () => {
  it("picks light text on dark fills", () => {
    expect(pickContrastColor("#2a1a4a")).toBe("#ffffff");
    expect(pickContrastColor("#000")).toBe("#ffffff");
  });
  it("picks dark text on light fills", () => {
    expect(pickContrastColor("#e8d9f5")).toBe("#1a1a1a");
    expect(pickContrastColor("#fff")).toBe("#1a1a1a");
  });
  it("honors custom light/dark colors", () => {
    expect(pickContrastColor("#000", "white", "black")).toBe("white");
    expect(pickContrastColor("#fff", "white", "black")).toBe("black");
  });
  it("falls back to light when fill is unresolvable outside the DOM", () => {
    // jsdom resolves named colors, so use an obviously unresolvable token.
    expect(pickContrastColor("not-a-color")).toBe("#ffffff");
  });
});
