import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChartTooltip from "./ChartTooltip.vue";

describe("ChartTooltip", () => {
  it("does not render when closed", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 50, y: 100, open: false },
      slots: { default: "<p>Hello</p>" },
    });
    expect(wrapper.find(".chart-tooltip-content").exists()).toBe(false);
  });

  it("renders positioned content in hover mode when open", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 50, y: 100, open: true },
      slots: { default: "<p>Hello</p>" },
    });
    const content = wrapper.find(".chart-tooltip-content");
    expect(content.exists()).toBe(true);
    expect(content.attributes("style")).toContain("left:");
    expect(content.attributes("style")).toContain("top: 100px");
    expect(content.text()).toContain("Hello");
  });

  it("renders anchor div in click mode", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 25, y: 75, open: false, mode: "click" as const },
    });
    const anchor = wrapper.find(".chart-tooltip-anchor");
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes("style")).toContain("left: 25px");
    expect(anchor.attributes("style")).toContain("top: 75px");
  });
});
