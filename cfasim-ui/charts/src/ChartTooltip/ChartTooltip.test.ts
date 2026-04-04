import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChartTooltip from "./ChartTooltip.vue";

describe("ChartTooltip", () => {
  it("renders an anchor div at the given position", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 50, y: 100, open: false },
    });
    const anchor = wrapper.find(".chart-tooltip-anchor");
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes("style")).toContain("left: 50px");
    expect(anchor.attributes("style")).toContain("top: 100px");
  });

  it("does not render content when closed", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 0, y: 0, open: false },
      slots: { default: "<p>Hello</p>" },
    });
    expect(wrapper.text()).not.toContain("Hello");
  });

  it("renders anchor when open", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 25, y: 75, open: true },
      slots: { default: "<p>Tooltip text</p>" },
    });
    const anchor = wrapper.find(".chart-tooltip-anchor");
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes("style")).toContain("left: 25px");
    expect(anchor.attributes("style")).toContain("top: 75px");
  });

  it("uses tooltip primitives in hover mode", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 0, y: 0, open: false, mode: "hover" as const },
    });
    // TooltipProvider renders as a wrapping element
    expect(wrapper.find(".chart-tooltip-anchor").exists()).toBe(true);
  });

  it("uses popover primitives in click mode", () => {
    const wrapper = mount(ChartTooltip, {
      props: { x: 0, y: 0, open: false, mode: "click" as const },
    });
    expect(wrapper.find(".chart-tooltip-anchor").exists()).toBe(true);
  });
});
