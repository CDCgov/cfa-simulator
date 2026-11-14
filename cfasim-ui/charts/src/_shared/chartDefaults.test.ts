import { describe, it, expect } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import LineChart from "../LineChart/LineChart.vue";
import type { LineChartProps } from "../LineChart/LineChart.vue";
import { provideChartDefaults, type ChartDefaults } from "./chartDefaults.js";

function mountWithDefaults(
  defaults: ChartDefaults,
  props: LineChartProps,
  nested?: ChartDefaults,
) {
  const chart = () =>
    h(LineChart, { width: 400, height: 200, menu: false, ...props });
  const Inner = defineComponent({
    setup() {
      if (nested) provideChartDefaults(nested);
      return chart;
    },
  });
  const App = defineComponent({
    setup() {
      provideChartDefaults(defaults);
      return () => h(Inner);
    },
  });
  return mount(App);
}

describe("provideChartDefaults", () => {
  const data = [0, 10, 20];

  it("styles charts below it, with a chart's own style merged over", () => {
    const defaults = { tickLabelStyle: { fontSize: 17, color: "red" } };
    const tickFills = (props: LineChartProps, fontSize: string) =>
      mountWithDefaults(defaults, props)
        .findAll("text")
        .filter((t) => t.attributes("font-size") === fontSize)
        .map((t) => t.attributes("fill"));

    expect(tickFills({ data }, "17")).toContain("red");
    const own = { data, tickLabelStyle: { fontSize: 9 } };
    expect(tickFills(own, "17")).toEqual([]);
    expect(tickFills(own, "9")).toContain("red");
  });

  it("turns the tooltip on unless the chart sets its own trigger", () => {
    const hasOverlay = (
      defaults: ChartDefaults,
      props: LineChartProps = { data },
      nested?: ChartDefaults,
    ) =>
      mountWithDefaults(defaults, props, nested)
        .findAll("rect")
        .some((r) => r.attributes("fill") === "transparent");
    const hover: ChartDefaults = { tooltipTrigger: "hover" };
    expect(hasOverlay({})).toBe(false);
    expect(hasOverlay(hover)).toBe(true);
    expect(hasOverlay(hover, { data, tooltipTrigger: "none" })).toBe(false);
    // A nested provider layers over the outer one.
    const nested = { tickLabelStyle: { fontSize: 17 } };
    expect(hasOverlay(hover, { data }, nested)).toBe(true);
  });
});
