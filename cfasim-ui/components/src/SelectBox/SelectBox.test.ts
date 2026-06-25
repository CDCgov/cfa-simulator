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

  it("visually hides the label when hideLabel is set", () => {
    const wrapper = mount(SelectBox, {
      props: {
        label: "Interval",
        options,
        modelValue: "daily",
        hideLabel: true,
      },
    });
    const label = wrapper.find(".select-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toContain("Interval");
    expect(label.classes()).toContain("visually-hidden");
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

  describe("autocomplete", () => {
    it("renders a combobox input instead of the select trigger", () => {
      const wrapper = mount(SelectBox, {
        props: {
          label: "Interval",
          options,
          modelValue: "daily",
          autocomplete: true,
        },
      });
      expect(wrapper.find(".select-trigger").exists()).toBe(false);
      const input = wrapper.find(".select-input");
      expect(input.exists()).toBe(true);
      expect(input.attributes("role")).toBe("combobox");
    });

    it("displays the selected option's label in the input", () => {
      const wrapper = mount(SelectBox, {
        props: { options, modelValue: "weekly", autocomplete: true },
      });
      expect(
        (wrapper.find(".select-input").element as HTMLInputElement).value,
      ).toBe("Weekly");
    });

    it("labels the input via aria-labelledby when a label is given", () => {
      const wrapper = mount(SelectBox, {
        props: {
          label: "Interval",
          options,
          modelValue: "daily",
          autocomplete: true,
        },
      });
      expect(
        wrapper.find(".select-input").attributes("aria-labelledby"),
      ).toBeDefined();
    });

    it("associates the label with the input for click-to-focus", () => {
      const wrapper = mount(SelectBox, {
        props: {
          label: "Interval",
          options,
          modelValue: "daily",
          autocomplete: true,
        },
      });
      const inputId = wrapper.find(".select-input").attributes("id");
      expect(inputId).toBeTruthy();
      expect(wrapper.find(".select-label").attributes("for")).toBe(inputId);
    });

    it("advertises list autocomplete and disables native autofill", () => {
      const wrapper = mount(SelectBox, {
        props: { options, modelValue: "daily", autocomplete: true },
      });
      const input = wrapper.find(".select-input");
      expect(input.attributes("aria-autocomplete")).toBe("list");
      // Suppress the browser's own autofill dropdown over reka's listbox.
      expect(input.attributes("autocomplete")).toBe("off");
    });

    it("exposes the chevron as a labelled toggle outside the tab order", () => {
      const wrapper = mount(SelectBox, {
        props: { options, modelValue: "daily", autocomplete: true },
      });
      const toggle = wrapper.find(".select-icon-button");
      expect(toggle.attributes("aria-label")).toBe("Toggle options");
      expect(toggle.attributes("aria-haspopup")).toBe("listbox");
      expect(toggle.attributes("tabindex")).toBe("-1");
    });

    it("falls back to ariaLabel when no label is given", () => {
      const wrapper = mount(SelectBox, {
        props: {
          options,
          modelValue: "",
          autocomplete: true,
          ariaLabel: "Pick interval",
        },
      });
      expect(wrapper.find(".select-input").attributes("aria-label")).toBe(
        "Pick interval",
      );
    });
  });
});
