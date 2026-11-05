import { describe, it, expect, vi } from "vitest";
import {
  useLegendHighlight,
  LEGEND_DIM_OPACITY,
} from "./useLegendHighlight.js";

describe("useLegendHighlight", () => {
  it("fades every label but the highlighted one while enabled", () => {
    const onChange = vi.fn();
    const labels = ["A", "B"];
    const { setHighlight, dimFor, dimForSeries } = useLegendHighlight({
      enabled: () => true,
      onChange,
      seriesLabel: (i) => labels[i],
    });
    expect(dimFor("A")).toBeUndefined();
    setHighlight("A");
    expect(dimFor("A")).toBeUndefined();
    expect(dimFor("B")).toBe(LEGEND_DIM_OPACITY);
    expect(dimFor(undefined)).toBe(LEGEND_DIM_OPACITY);
    expect(dimForSeries(0)).toBeUndefined();
    expect(dimForSeries(1)).toBe(LEGEND_DIM_OPACITY);
    expect(dimForSeries(undefined)).toBe(LEGEND_DIM_OPACITY);
    setHighlight(null);
    expect(dimFor("B")).toBeUndefined();
    expect(onChange.mock.calls).toEqual([["A"], [null]]);
  });

  it("reports hover without fading when disabled, once per change", () => {
    const onChange = vi.fn();
    const { setHighlight, dimFor } = useLegendHighlight({
      enabled: () => false,
      onChange,
      seriesLabel: () => undefined,
    });
    setHighlight("A");
    setHighlight("A");
    expect(dimFor("B")).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
