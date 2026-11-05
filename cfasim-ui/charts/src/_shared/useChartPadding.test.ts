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

describe("useChartPadding legend position", () => {
  it("reserves the legend rows above the plot by default", () => {
    const { padding, legendY, bottomLegendHeight } = layout();
    expect(padding.value.top).toBe(10 + INLINE_LEGEND_ROW_HEIGHT);
    expect(padding.value.bottom).toBe(30);
    expect(legendY.value).toBe(10 + INLINE_LEGEND_ROW_HEIGHT / 2);
    expect(bottomLegendHeight.value).toBe(0);
  });

  it("moves the legend rows under the plot with legendPosition bottom", () => {
    const { padding, legendY, bottomLegendHeight } = layout({
      legendPosition: () => "bottom",
    });
    expect(padding.value.top).toBe(10);
    expect(padding.value.bottom).toBe(30 + INLINE_LEGEND_ROW_HEIGHT);
    expect(bottomLegendHeight.value).toBe(INLINE_LEGEND_ROW_HEIGHT);
    expect(legendY.value).toBe(200 - INLINE_LEGEND_ROW_HEIGHT / 2);
  });

  it("stacks wrapped rows upward from the bottom edge", () => {
    const { padding, legendY, inlineLegendLayout } = layout({
      legendPosition: () => "bottom",
      inlineLegendLabels: () => ["A long legend label", "Another long one"],
      width: () => 160,
    });
    expect(inlineLegendLayout.value.rowCount).toBe(2);
    expect(padding.value.bottom).toBe(30 + 2 * INLINE_LEGEND_ROW_HEIGHT);
    expect(legendY.value).toBe(
      200 - 2 * INLINE_LEGEND_ROW_HEIGHT + INLINE_LEGEND_ROW_HEIGHT / 2,
    );
  });

  it("sits under height the chart adds below the plot", () => {
    const { padding, legendY } = layout({
      legendPosition: () => "bottom",
      xLabel: () => "Weeks",
      extraBelowHeight: () => 40,
    });
    expect(padding.value.bottom).toBe(38 + INLINE_LEGEND_ROW_HEIGHT);
    expect(legendY.value).toBe(240 - INLINE_LEGEND_ROW_HEIGHT / 2);
  });

  it("keeps extra bottom padding between the axis and the legend", () => {
    const { padding, legendY } = layout({
      legendPosition: () => "bottom",
      extraPadding: () => ({ bottom: 12 }),
    });
    expect(padding.value.bottom).toBe(30 + INLINE_LEGEND_ROW_HEIGHT + 12);
    expect(legendY.value).toBe(200 - INLINE_LEGEND_ROW_HEIGHT / 2);
  });
});
