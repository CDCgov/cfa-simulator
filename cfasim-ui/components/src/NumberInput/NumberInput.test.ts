import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import NumberInput from "./NumberInput.vue";

describe("NumberInput", () => {
  it("renders hint trigger when hint prop is provided", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 1000,
        label: "Population",
        hint: "Population must be between 1,000 and 100,000.",
      },
    });

    const hintButton = wrapper.find(".HintTrigger");
    expect(hintButton.exists()).toBe(true);
  });

  it("renders a label element when label prop is provided", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 42,
        label: "Population",
      },
    });

    const label = wrapper.find("label.input-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toContain("Population");
    expect(label.find("input").exists()).toBe(true);
  });

  it("does not render a label element when label is not provided", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 42,
      },
    });

    expect(wrapper.find("label").exists()).toBe(false);
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("does not render hint trigger when hint is not provided", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 1000,
      },
    });

    expect(wrapper.find(".HintTrigger").exists()).toBe(false);
  });

  it("does not emit update on typing, only on blur", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        "onUpdate:modelValue": (v: number) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(200);
    // Model should not have updated yet
    expect(wrapper.props("modelValue")).toBe(100);

    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(200);
  });

  it("emits update on Enter keydown", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        "onUpdate:modelValue": (v: number) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(300);
    expect(wrapper.props("modelValue")).toBe(100);

    await input.trigger("keydown.enter");
    expect(wrapper.props("modelValue")).toBe(300);
  });

  it("displays fraction as percentage when percent prop is set", () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 0.91, label: "Immunity", percent: true },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("91");
    expect(wrapper.find(".input-suffix").text()).toBe("%");
  });

  it("commits displayed percentage back as fraction", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        "onUpdate:modelValue": (v: number) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.setValue(85);
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeCloseTo(0.85);
  });

  it("defaults step/min/max for percent mode", () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 0.5, label: "Rate", percent: true },
    });
    const input = wrapper.find("input");
    const el = input.element as HTMLInputElement;
    expect(el.step).toBe("1");
    expect(el.min).toBe("0");
    expect(el.max).toBe("100");
  });

  it("does not show suffix when percent is not set", () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 42, label: "Count" },
    });
    expect(wrapper.find(".input-suffix").exists()).toBe(false);
  });

  it("shows error and does not commit when value exceeds max", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 50,
        label: "Count",
        max: 100,
        "onUpdate:modelValue": (v: number) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(200);
    await input.trigger("blur");

    expect(wrapper.props("modelValue")).toBe(50);
    expect(wrapper.find(".input-error").exists()).toBe(true);
    expect(wrapper.find(".input-error").text()).toBe("Max 100");
    expect(
      (input.element as HTMLInputElement).getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("shows error and does not commit when value is below min", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 50,
        label: "Count",
        min: 10,
        "onUpdate:modelValue": (v: number) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(5);
    await input.trigger("blur");

    expect(wrapper.props("modelValue")).toBe(50);
    expect(wrapper.find(".input-error").text()).toBe("Min 10");
  });

  it("clears error when valid value is committed", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 50,
        label: "Count",
        max: 100,
        "onUpdate:modelValue": (v: number) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(200);
    await input.trigger("blur");
    expect(wrapper.find(".input-error").exists()).toBe(true);

    await input.setValue(80);
    await input.trigger("blur");
    expect(wrapper.find(".input-error").exists()).toBe(false);
    expect(wrapper.props("modelValue")).toBe(80);
  });

  it("shows percent suffix in error message for percent mode", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        max: 0.99,
        "onUpdate:modelValue": (v: number) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(100);
    await input.trigger("blur");

    expect(wrapper.props("modelValue")).toBe(0.5);
    expect(wrapper.find(".input-error").text()).toBe("Max 99%");
  });

  it("syncs local value when model changes externally", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
      },
    });

    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("100");

    await wrapper.setProps({ modelValue: 500 });
    expect((input.element as HTMLInputElement).value).toBe("500");
  });
});
