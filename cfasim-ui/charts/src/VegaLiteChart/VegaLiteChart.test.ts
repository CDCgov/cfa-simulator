import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import VegaLiteChart from "./VegaLiteChart.vue";
import type { VegaLiteSpec } from "./vegaLite.js";

const rows = [
  { day: "a", n: 1 },
  { day: "b", n: 3 },
];
const barSpec: VegaLiteSpec = {
  mark: "bar",
  encoding: {
    x: { field: "day", type: "nominal" },
    y: { field: "n", type: "quantitative" },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("VegaLiteChart", () => {
  it("renders the chart the spec asks for, with extra attributes over its props", () => {
    const wrapper = mount(VegaLiteChart, {
      props: { spec: { ...barSpec, title: "From spec" }, data: rows },
      attrs: { title: "Override", menu: false, "data-testid": "vl" },
      attachTo: document.body,
    });
    const root = document.querySelector('[data-testid="vl"]')!;
    expect(root.querySelectorAll('[data-testid="bar"]')).toHaveLength(2);
    expect(root.textContent).toContain("Override");
    expect(root.textContent).not.toContain("From spec");
    wrapper.unmount();
  });

  it("lets a kebab-case attribute override the translated camelCase prop", () => {
    const wrapper = mount(VegaLiteChart, {
      props: {
        spec: {
          mark: "line",
          encoding: {
            x: { field: "day", type: "ordinal" },
            y: { field: "n", type: "quantitative", scale: { domain: [0, 5] } },
          },
        },
        data: rows,
      },
      attrs: { "y-max": 50, menu: false },
      attachTo: document.body,
    });
    const ticks = [...document.querySelectorAll('[data-testid="y-tick"]')].map(
      (t) => Number(t.textContent),
    );
    // The spec's domain would stop the axis at 5.
    expect(Math.max(...ticks)).toBeGreaterThan(5);
    wrapper.unmount();
  });

  it("logs and emits what the spec skipped, once until it changes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(VegaLiteChart, {
      props: {
        spec: { ...barSpec, transform: [{ filter: "true" }] },
        data: rows,
        menu: false,
      } as never,
    });
    const msg =
      "`transform` is not supported; pass rows that are ready to plot";
    expect(wrapper.emitted("warnings")).toEqual([[[msg]]]);
    expect(warn).toHaveBeenCalledWith(`[VegaLiteChart] ${msg}`);
    // New rows re-translate the spec but repeat the same warnings.
    await wrapper.setProps({ data: [...rows, { day: "c", n: 2 }] });
    expect(wrapper.emitted("warnings")).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("renders nothing and emits an error with strict", () => {
    const wrapper = mount(VegaLiteChart, {
      props: {
        spec: { ...barSpec, transform: [{ filter: "true" }] },
        data: rows,
        strict: true,
      },
      attachTo: document.body,
    });
    const [[error]] = wrapper.emitted("error") as [[Error]];
    expect(error.message).toBe(
      "Vega-Lite: `transform` is not supported; pass rows that are ready to plot",
    );
    expect(document.querySelector("svg")).toBeNull();
    wrapper.unmount();
  });
});
