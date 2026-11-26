import { describe, it, expect } from "vitest";
import {
  useChartPadding,
  INLINE_LEGEND_ROW_HEIGHT,
  type ChartPaddingOptions,
} from "./useChartPadding.js";

function layout(opts: Partial<ChartPaddingOptions> = {}) {
  return useChartPadding({
    title: () => undefined,
    xLabel: () => undefined,
    yLabel: () => undefined,
    inlineLegendLabels: () => ["Cases", "Deaths"],
    width: () => 400,
    height: () => 200,
    ...opts,
  });
}

describe("useChartPadding", () => {
  it("reserves top or bottom legend height including legendExtraHeight and extraPadding", () => {
    const top = layout({ legendExtraHeight: () => 12 });
    expect(top.padding.value.top).toBe(10 + INLINE_LEGEND_ROW_HEIGHT + 12);
    expect(top.bottomLegendHeight.value).toBe(0);

    const noLegend = layout({
      inlineLegendLabels: () => [],
      legendExtraHeight: () => 12,
    });
    expect(noLegend.padding.value.top).toBe(10);

    const bottom = layout({
      legendPosition: () => "bottom",
      legendExtraHeight: () => 12,
      extraPadding: () => ({ bottom: 8 }),
      extraBelowHeight: () => 40,
    });
    expect(bottom.bottomLegendHeight.value).toBe(INLINE_LEGEND_ROW_HEIGHT + 12);
    expect(bottom.padding.value.bottom).toBe(
      30 + INLINE_LEGEND_ROW_HEIGHT + 12 + 8,
    );
    expect(bottom.legendY.value).toBe(
      240 - INLINE_LEGEND_ROW_HEIGHT - 12 + INLINE_LEGEND_ROW_HEIGHT / 2,
    );
  });

  it("lays out grid and fixed-column legends and wraps rows within width", () => {
    const labels = ["A", "Quite a long label", "B", "C", "D"];
    const grid = layout({
      inlineLegendLabels: () => labels,
      legendLayout: () => "grid",
      width: () => 400,
    });
    expect(grid.inlineLegendLayout.value.positions.map((p) => p.x)).toEqual([
      0, 160, 0, 160, 0,
    ]);
    expect(grid.inlineLegendLayout.value.rowCount).toBe(3);

    const fixed = layout({
      inlineLegendLabels: () => labels,
      legendLayout: () => ({ columns: 4 }),
    });
    expect(fixed.inlineLegendLayout.value.rowCount).toBe(2);

    const narrow = layout({
      inlineLegendLabels: () => labels,
      legendLayout: () => "grid",
      width: () => 100,
    });
    expect(narrow.inlineLegendLayout.value.rowCount).toBe(5);
  });
});
