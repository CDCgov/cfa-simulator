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
  it("renders translated components and lets attrs (including kebab-case) override spec props", () => {
    const heatmap = mount(VegaLiteChart, {
      props: {
        spec: {
          mark: "rect",
          encoding: {
            x: { field: "day", type: "nominal" },
            y: { field: "day", type: "nominal" },
            color: { field: "n", type: "quantitative" },
          },
        },
        data: rows,
      },
      attrs: { menu: false, "data-testid": "vl-heat" },
      attachTo: document.body,
    });
    expect(
      document.querySelectorAll('[data-testid="vl-heat"] [data-testid="cell"]'),
    ).toHaveLength(2);
    heatmap.unmount();

    const bar = mount(VegaLiteChart, {
      props: { spec: { ...barSpec, title: "From spec" }, data: rows },
      attrs: {
        title: "Override",
        "value-max": 50,
        menu: false,
        "data-testid": "vl-bar",
      },
      attachTo: document.body,
    });
    const root = document.querySelector('[data-testid="vl-bar"]')!;
    expect(root.querySelectorAll('[data-testid="bar"]')).toHaveLength(2);
    expect(root.textContent).toContain("Override");
    bar.unmount();
  });

  it("emits warnings once until they change, and emits error in strict mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(VegaLiteChart, {
      props: {
        spec: { ...barSpec, transform: [{ filter: "true" }] },
        data: rows,
        menu: false,
      } as never,
    });
    expect(wrapper.emitted("warnings")).toHaveLength(1);
    await wrapper.setProps({ data: [...rows, { day: "c", n: 2 }] });
    expect(wrapper.emitted("warnings")).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    wrapper.unmount();

    const strict = mount(VegaLiteChart, {
      props: {
        spec: { ...barSpec, transform: [{ filter: "true" }] },
        data: rows,
        strict: true,
      },
      attachTo: document.body,
    });
    const [[error]] = strict.emitted("error") as [[Error]];
    expect(error.message).toContain("`transform` is not supported");
    expect(document.querySelector("svg")).toBeNull();
    strict.unmount();
  });
});
