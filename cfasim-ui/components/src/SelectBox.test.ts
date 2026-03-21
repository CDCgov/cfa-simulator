import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SelectBox from "./SelectBox.vue";

const options = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

describe("SelectBox", () => {
  it("renders with label", () => {
    const wrapper = mount(SelectBox, {
      props: { label: "Interval", options, modelValue: "daily" },
    });
    expect(wrapper.text()).toContain("Interval");
  });

  it("renders without label", () => {
    const wrapper = mount(SelectBox, {
      props: { options, modelValue: "weekly" },
    });
    expect(wrapper.find(".select-label").exists()).toBe(false);
  });

  it("renders trigger element", () => {
    const wrapper = mount(SelectBox, {
      props: { options, modelValue: "weekly" },
    });
    const trigger = wrapper.find(".select-trigger");
    expect(trigger.exists()).toBe(true);
    expect(trigger.element.tagName).toBe("BUTTON");
  });

  it("has accessible trigger button", () => {
    const wrapper = mount(SelectBox, {
      props: { label: "Interval", options, modelValue: "daily" },
    });
    const trigger = wrapper.find(".select-trigger");
    expect(trigger.attributes("role")).toBe("combobox");
    expect(trigger.attributes("aria-labelledby")).toBeDefined();
  });
});
