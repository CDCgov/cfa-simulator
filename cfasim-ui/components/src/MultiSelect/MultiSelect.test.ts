import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MultiSelect from "./MultiSelect.vue";

const options = [
  { value: "ca", label: "California" },
  { value: "ny", label: "New York" },
  { value: "tx", label: "Texas" },
];

describe("MultiSelect", () => {
  it("renders with label", () => {
    const wrapper = mount(MultiSelect, {
      props: { label: "States", options, modelValue: [] },
    });
    expect(wrapper.text()).toContain("States");
  });

  it("renders without label", () => {
    const wrapper = mount(MultiSelect, {
      props: { options, modelValue: [] },
    });
    expect(wrapper.find(".multi-select-label").exists()).toBe(false);
  });

  it("visually hides the label when hideLabel is set", () => {
    const wrapper = mount(MultiSelect, {
      props: { label: "States", options, modelValue: [], hideLabel: true },
    });
    const label = wrapper.find(".multi-select-label");
    expect(label.exists()).toBe(true);
    expect(label.classes()).toContain("visually-hidden");
  });

  it("renders a chip per selected value", () => {
    const wrapper = mount(MultiSelect, {
      props: { options, modelValue: ["ca", "tx"] },
    });
    const chips = wrapper.findAll(".multi-select-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0].text()).toContain("California");
    expect(chips[1].text()).toContain("Texas");
  });

  it("ignores selected values not present in options", () => {
    const wrapper = mount(MultiSelect, {
      props: { options, modelValue: ["ca", "zz"] },
    });
    expect(wrapper.findAll(".multi-select-chip")).toHaveLength(1);
  });

  it("removes a value via its chip button", async () => {
    const wrapper = mount(MultiSelect, {
      props: { options, modelValue: ["ca", "tx"] },
    });
    await wrapper
      .find(".multi-select-chip-remove[aria-label='Remove California']")
      .trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([["tx"]]);
  });

  it("removes the last chip on backspace in an empty input", async () => {
    const wrapper = mount(MultiSelect, {
      props: { options, modelValue: ["ca", "tx"] },
    });
    const input = wrapper.find(".multi-select-input");
    await input.trigger("keydown", { key: "Backspace" });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([["ca"]]);
  });

  it("has an accessible combobox input", () => {
    const wrapper = mount(MultiSelect, {
      props: { label: "States", options, modelValue: [] },
    });
    const input = wrapper.find(".multi-select-input");
    expect(input.attributes("role")).toBe("combobox");
    expect(input.attributes("aria-labelledby")).toBeDefined();
  });

  it("falls back to ariaLabel when no label is given", () => {
    const wrapper = mount(MultiSelect, {
      props: { options, modelValue: [], ariaLabel: "Pick states" },
    });
    const input = wrapper.find(".multi-select-input");
    expect(input.attributes("aria-label")).toBe("Pick states");
  });
});
