import { describe, it, expect, afterEach, vi } from "vitest";
import { placeTooltip } from "./tooltip-position.js";

const GAP = 16;
const PAD = 8;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("placeTooltip", () => {
  it("clamp:none pins to the right of the pointer with no flip/clamp", () => {
    const r = placeTooltip(100, 200, 120, 40, "none");
    expect(r).toEqual({ left: 100 + GAP, top: 200 });
  });

  it("clamp:window places right when there is room", () => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    const r = placeTooltip(100, 200, 120, 40, "window");
    expect(r.left).toBe(100 + GAP);
    expect(r.top).toBe(200);
  });

  it("clamp:window flips to the left of the pointer near the right edge", () => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    // A 300px-wide tip at x=950 would overflow the right edge, so it flips.
    const r = placeTooltip(950, 200, 300, 40, "window");
    expect(r.left).toBe(950 - GAP - 300);
    expect(r.left + 300).toBeLessThanOrEqual(1000 - PAD);
  });

  it("clamp:window clamps the vertical center inside the viewport", () => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    const halfH = 40 / 2;
    // Pointer near the top: top clamps down so the tip doesn't clip.
    expect(placeTooltip(100, 2, 120, 40, "window").top).toBe(PAD + halfH);
    // Pointer near the bottom: top clamps up.
    expect(placeTooltip(100, 799, 120, 40, "window").top).toBe(
      800 - PAD - halfH,
    );
  });

  it("clamp:chart flips and clamps against the chart rect, not the window", () => {
    const chartRect = {
      left: 400,
      right: 700,
      top: 100,
      bottom: 300,
    } as DOMRect;
    // Pointer near the chart's right edge → flip left within the chart box.
    const r = placeTooltip(680, 150, 200, 40, "chart", chartRect);
    expect(r.left).toBe(680 - GAP - 200);
    expect(r.left).toBeGreaterThanOrEqual(400 + PAD);
  });

  it("clamps the left edge when a left-flip would overflow the far side", () => {
    // Narrow chart, wide tooltip: the right placement would overflow right,
    // so it flips left — but the left-flip would then overflow the chart's
    // left edge. It must pin to the left edge instead.
    const chartRect = {
      left: 0,
      right: 250,
      top: 0,
      bottom: 400,
    } as DOMRect;
    const r = placeTooltip(240, 200, 200, 40, "chart", chartRect);
    expect(r.left).toBeGreaterThanOrEqual(0 + PAD);
    expect(r.left).toBeLessThanOrEqual(250 - PAD - 200 + 0.001);
  });
});
