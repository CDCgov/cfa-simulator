import { describe, it, expect, vi } from "vitest";
import {
  useLegendHighlight,
  LEGEND_DIM_OPACITY,
} from "./useLegendHighlight.js";

function setup(over: Partial<Parameters<typeof useLegendHighlight>[0]> = {}) {
  const labels = ["A", "B"];
  const onChange = vi.fn();
  const api = useLegendHighlight({
    enabled: () => true,
    toggle: () => false,
    isHidden: () => false,
    seriesLabel: (i) => labels[i],
    onChange,
    ...over,
  });
  return { ...api, onChange };
}

describe("useLegendHighlight", () => {
  it("fades every label but the highlighted one while enabled", () => {
    const { setHighlight, dimFor, dimForSeries, dimForInterval, onChange } =
      setup();
    expect(dimFor("A")).toBeUndefined();
    setHighlight("A");
    expect(dimFor("A")).toBeUndefined();
    expect(dimFor("B")).toBe(LEGEND_DIM_OPACITY);
    expect(dimFor(undefined)).toBe(LEGEND_DIM_OPACITY);
    expect(dimForSeries(0)).toBeUndefined();
    expect(dimForSeries(1)).toBe(LEGEND_DIM_OPACITY);
    expect(dimForSeries(undefined)).toBe(LEGEND_DIM_OPACITY);
    expect(dimForInterval({ x: 0, lower: 0, upper: 1, seriesIndex: 1 })).toBe(
      LEGEND_DIM_OPACITY,
    );
    setHighlight(null);
    expect(dimFor("B")).toBeUndefined();
    expect(onChange.mock.calls).toEqual([["A"], [null]]);
  });

  it("reports hover without fading when disabled, once per change", () => {
    const { setHighlight, dimFor, onChange } = setup({
      enabled: () => false,
    });
    setHighlight("A");
    setHighlight("A");
    expect(dimFor("B")).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("fades nothing while the highlighted label is hidden", () => {
    const { setHighlight, dimFor } = setup({
      isHidden: (label) => label === "A",
    });
    setHighlight("A");
    expect(dimFor("B")).toBeUndefined();
  });

  it("draws its own hit targets only without toggle buttons", () => {
    expect(setup().hitTargets.value).toBe(true);
    expect(setup({ toggle: () => true }).hitTargets.value).toBe(false);
    expect(setup({ toggle: () => "isolate" }).hitTargets.value).toBe(false);
    expect(setup({ enabled: () => undefined }).hitTargets.value).toBe(false);
  });
});
