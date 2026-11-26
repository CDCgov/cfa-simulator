import { describe, it, expect, vi } from "vitest";
import {
  useLegendHighlight,
  LEGEND_DIM_OPACITY,
} from "./useLegendHighlight.js";

function setup(over: Partial<Parameters<typeof useLegendHighlight>[0]> = {}) {
  const labels = ["A", "B"];
  const onChange = vi.fn();
  return {
    ...useLegendHighlight({
      enabled: () => true,
      toggle: () => false,
      isHidden: () => false,
      seriesLabel: (i) => labels[i],
      onChange,
      ...over,
    }),
    onChange,
  };
}

describe("useLegendHighlight", () => {
  it("dims non-highlighted labels/series/intervals, skips hidden or disabled, and manages hitTargets", () => {
    const { setHighlight, dimFor, dimForSeries, dimForInterval, onChange } =
      setup();
    setHighlight("A");
    expect(dimFor("A")).toBeUndefined();
    expect(dimFor("B")).toBe(LEGEND_DIM_OPACITY);
    expect(dimForSeries(1)).toBe(LEGEND_DIM_OPACITY);
    expect(dimForInterval({ x: 0, lower: 0, upper: 1, seriesIndex: 1 })).toBe(
      LEGEND_DIM_OPACITY,
    );
    setHighlight(null);
    expect(onChange.mock.calls).toEqual([["A"], [null]]);

    const hidden = setup({ isHidden: (label) => label === "A" });
    hidden.setHighlight("A");
    expect(hidden.dimFor("B")).toBeUndefined();

    const disabled = setup({ enabled: () => false });
    disabled.setHighlight("A");
    disabled.setHighlight("A");
    expect(disabled.dimFor("B")).toBeUndefined();
    expect(disabled.onChange).toHaveBeenCalledTimes(1);

    expect(setup().hitTargets.value).toBe(true);
    expect(setup({ toggle: () => true }).hitTargets.value).toBe(false);
  });
});
