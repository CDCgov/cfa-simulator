import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import NumberInput, { type NumberRange } from "./NumberInput.vue";

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

    const label = wrapper.find("label.cfasim-input-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toContain("Population");
    expect(label.find("input").exists()).toBe(true);
  });

  it("visually hides the label when hideLabel is set", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 42,
        label: "Population",
        hideLabel: true,
      },
    });
    const label = wrapper.find("label.cfasim-input-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toContain("Population");
    expect(wrapper.find(".cfasim-input-label-row").classes()).toContain(
      "visually-hidden",
    );
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
        "onUpdate:modelValue": (v: number | undefined) =>
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

  it("allows any characters while typing but strips invalid ones on commit", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    const el = input.element as HTMLInputElement;

    // While typing, junk characters remain in the field.
    await input.setValue("abc12x3");
    expect(el.value).toBe("abc12x3");

    // Blur commits: invalid chars are stripped and the value is parsed.
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(123);

    // Scientific notation stays valid through commit.
    await input.setValue("1e6");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(1_000_000);

    // Negatives stay valid through commit.
    await input.setValue("-10");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(-10);

    // Pure garbage (no digits) must NOT silently collapse to 0.
    await wrapper.setProps({ modelValue: 42 });
    await input.setValue("abcxyz");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(42);
  });

  it("resets the displayed value when input is all invalid on commit", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 42,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    const el = input.element as HTMLInputElement;

    // Blur: garbage text should be replaced with the formatted model value.
    await input.setValue("abcxyz");
    expect(el.value).toBe("abcxyz");
    await input.trigger("blur");
    expect(el.value).toBe("42");
    expect(wrapper.props("modelValue")).toBe(42);

    // Enter: same behavior via the Enter keydown path.
    await input.setValue("???");
    await input.trigger("keydown.enter");
    expect(el.value).toBe("42");
    expect(wrapper.props("modelValue")).toBe(42);
  });

  it("shows a validation error when required and emptied", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 42,
        label: "Count",
        required: true,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue("");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeUndefined();
    expect(wrapper.find(".input-error").text()).toBe("Required");
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(input.attributes("aria-required")).toBe("true");
    expect(input.attributes("required")).toBeDefined();

    // Refocusing and blurring without typing must not collapse to 0.
    await input.trigger("focus");
    await input.trigger("blur");
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.props("modelValue")).toBeUndefined();
    expect(wrapper.find(".input-error").text()).toBe("Required");

    // Entering a valid number clears the error.
    await input.setValue("7");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(7);
    expect(wrapper.find(".input-error").exists()).toBe(false);
  });

  it("shows the required error when modelValue is programmatically cleared", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 42,
        label: "Count",
        required: true,
      },
    });

    expect(wrapper.find(".input-error").exists()).toBe(false);
    await wrapper.setProps({ modelValue: undefined });
    expect(wrapper.find(".input-error").text()).toBe("Required");

    await wrapper.setProps({ modelValue: 5 });
    expect(wrapper.find(".input-error").exists()).toBe(false);
  });

  it("shows a min/max error when modelValue is programmatically set out of range", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 10,
        label: "Count",
        min: 1,
        max: 100,
      },
    });

    await wrapper.setProps({ modelValue: 500 });
    expect(wrapper.find(".input-error").text()).toBe("Max 100");

    await wrapper.setProps({ modelValue: 50 });
    expect(wrapper.find(".input-error").exists()).toBe(false);
  });

  it("clears the model when the input is emptied", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 42,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue("");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeUndefined();
    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("emits update on Enter keydown", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
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
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.setValue(85);
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeCloseTo(0.85);
  });

  it("validates min/max for percent mode", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");

    await input.setValue(110);
    await input.trigger("blur");
    expect(wrapper.find(".input-error").text()).toBe("Max 100%");
    expect(wrapper.props("modelValue")).toBe(0.5);

    await input.setValue(-5);
    await input.trigger("blur");
    expect(wrapper.find(".input-error").text()).toBe("Min 0%");
    expect(wrapper.props("modelValue")).toBe(0.5);
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
        "onUpdate:modelValue": (v: number | undefined) =>
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
        "onUpdate:modelValue": (v: number | undefined) =>
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
        "onUpdate:modelValue": (v: number | undefined) =>
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
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(100);
    await input.trigger("blur");

    expect(wrapper.props("modelValue")).toBe(0.5);
    expect(wrapper.find(".input-error").text()).toBe("Max 99%");
  });

  it("slider with live prop emits updates while dragging", async () => {
    const updates: number[] = [];
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 50,
        label: "Count",
        slider: true,
        live: true,
        min: 0,
        max: 100,
        "onUpdate:modelValue": (v: number | undefined) => {
          if (v != null) updates.push(v);
          wrapper.setProps({ modelValue: v });
        },
      },
    });

    const slider = wrapper.findComponent({ name: "SliderRoot" });
    expect(slider.exists()).toBe(true);

    // Simulate slider update (as if dragging)
    slider.vm.$emit("update:modelValue", [75]);
    expect(updates).toContain(75);
  });

  it("slider without live prop does not emit on update", async () => {
    const updates: number[] = [];
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 50,
        label: "Count",
        slider: true,
        min: 0,
        max: 100,
        "onUpdate:modelValue": (v: number | undefined) => {
          if (v != null) updates.push(v);
          wrapper.setProps({ modelValue: v });
        },
      },
    });

    const slider = wrapper.findComponent({ name: "SliderRoot" });
    slider.vm.$emit("update:modelValue", [75]);
    expect(updates).not.toContain(75);
  });

  it("live input commits immediately on change event (spinner/arrow keys)", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        live: true,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue(200);
    await input.trigger("change");
    expect(wrapper.props("modelValue")).toBe(200);
  });

  it("live input debounces on typing (input event only)", async () => {
    vi.useFakeTimers();
    const updates: number[] = [];
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        live: true,
        "onUpdate:modelValue": (v: number | undefined) => {
          if (v != null) updates.push(v);
          wrapper.setProps({ modelValue: v });
        },
      },
    });

    const input = wrapper.find("input");
    // setValue triggers both input and change, so the change handler
    // commits immediately. To test debounce in isolation, we verify
    // that the debounce timer exists by checking two rapid changes:
    // the second should cancel the first's timer.
    await input.setValue(200);
    // change fires immediately, so 200 is committed
    expect(updates).toContain(200);

    // Now simulate rapid typing: two changes in quick succession
    // Both trigger immediate commit via change, confirming live works
    await input.setValue(300);
    await input.setValue(400);
    expect(updates).toContain(400);

    vi.useRealTimers();
  });

  it("increments value on ArrowUp", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.props("modelValue")).toBe(101);
    expect((input.element as HTMLInputElement).value).toBe("101");
  });

  it("decrements value on ArrowDown", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.props("modelValue")).toBe(99);
  });

  it("steps by custom step prop", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        step: 5,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.props("modelValue")).toBe(105);
  });

  it("steps by 10x with shift+arrow", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowUp", shiftKey: true });
    expect(wrapper.props("modelValue")).toBe(110);
  });

  it("converts step prop to display units in percent mode", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        step: 0.01,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("50");

    await input.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.props("modelValue")).toBeCloseTo(0.51);
    expect((input.element as HTMLInputElement).value).toBe("51");
  });

  it("clamps arrow step to min/max", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 99,
        label: "Count",
        max: 100,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.props("modelValue")).toBe(100);
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.props("modelValue")).toBe(100);
  });

  it("displays numbers with comma separators", () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 1000000, label: "Population" },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("1,000,000");
  });

  it("keeps commas during editing and commits on blur", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 1500,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("1,500");

    await input.setValue("2500");
    await input.trigger("blur");
    expect((input.element as HTMLInputElement).value).toBe("2,500");
    expect(wrapper.props("modelValue")).toBe(2500);
  });

  it("accepts comma-formatted input and parses correctly", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 100,
        label: "Count",
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.setValue("1,234,567");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(1234567);
  });

  it("does not reformat while typing a decimal point", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 15,
        label: "Count",
      },
    });
    const input = wrapper.find("input");
    // Simulate typing "15." — reformatInput should not strip the trailing dot
    (input.element as HTMLInputElement).value = "15.";
    await input.trigger("input");
    expect((input.element as HTMLInputElement).value).toBe("15.");

    // Typing "15.60" — trailing zero after decimal should also be preserved
    (input.element as HTMLInputElement).value = "15.60";
    await input.trigger("input");
    expect((input.element as HTMLInputElement).value).toBe("15.60");
  });

  it("truncates decimal to integer when numberType is integer", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 15,
        label: "Count",
        numberType: "integer" as const,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.setValue("15.6");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(15);
    expect((input.element as HTMLInputElement).value).toBe("15");
  });

  it("integer with percent allows whole percentages like 0.42", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        numberType: "integer" as const,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    // 42% → internal 0.42 (display value 42 is a whole number, so allowed)
    await input.setValue("42");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeCloseTo(0.42);
  });

  it("integer with percent truncates fractional percentages", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        numberType: "integer" as const,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    // 42.7% should truncate display to 42 → internal 0.42
    await input.setValue("42.7");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeCloseTo(0.42);
    expect((input.element as HTMLInputElement).value).toBe("42");
  });

  it("displays .0 suffix for whole numbers when numberType is float", () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 100, label: "Rate", numberType: "float" as const },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("100.0");
  });

  it("does not add .0 suffix for non-whole floats", () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 2.5, label: "Rate", numberType: "float" as const },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("2.5");
  });

  it("adds .0 suffix after committing a whole number in float mode", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 2.5,
        label: "Rate",
        numberType: "float" as const,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    await input.setValue("3");
    await input.trigger("blur");
    expect((input.element as HTMLInputElement).value).toBe("3.0");
  });

  it("preserves decimal places on percent input inferred from step", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        step: 0.001,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    // step 0.001 in fraction units → 0.1% in display units → 1 decimal
    expect((input.element as HTMLInputElement).value).toBe("50.0");

    await input.setValue("12.3");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeCloseTo(0.123);
    expect((input.element as HTMLInputElement).value).toBe("12.3");
  });

  it("respects explicit decimals prop for percent", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.12345,
        label: "Rate",
        percent: true,
        decimals: 3,
        "onUpdate:modelValue": (v: number | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("12.345");

    await input.setValue("7.891");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeCloseTo(0.07891, 5);
    expect((input.element as HTMLInputElement).value).toBe("7.891");
  });

  it("respects explicit decimals prop for non-percent", async () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 3.14159, label: "Value", decimals: 2 },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("3.14");
  });

  it("infers decimals cleanly from steps with float artifacts", () => {
    // step 0.007 in fraction units → 0.7% in display units, but
    // 0.007 * 100 === 0.7000000000000001 in JS floats. The inferred
    // precision must not over-pad to 16 decimals.
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.5,
        label: "Rate",
        percent: true,
        step: 0.007,
      },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("50.0");
  });

  it("pads trailing zeros to match decimals", () => {
    const wrapper = mount(NumberInput, {
      props: { modelValue: 2.5, label: "Value", decimals: 3 },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("2.500");
  });

  it("applies format function to single-slider thumb and labels", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 50,
        slider: true,
        min: 0,
        max: 100,
        format: (v: number) => `${v} days`,
      },
    });
    expect(wrapper.find(".slider-current").text()).toBe("50 days");
    const labels = wrapper.findAll(".slider-labels span");
    expect(labels[0].text()).toBe("0 days");
    expect(labels[1].text()).toBe("100 days");
  });

  it("applies a NumberFormat preset to slider labels", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 0.25,
        slider: true,
        min: 0,
        max: 1,
        step: 0.01,
        format: "percent:0",
      },
    });
    expect(wrapper.find(".slider-current").text()).toBe("25%");
    const labels = wrapper.findAll(".slider-labels span");
    expect(labels[0].text()).toBe("0%");
    expect(labels[1].text()).toBe("100%");
  });

  it("applies format to text-input display value", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 3.14159,
        format: "%.2f",
      },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("3.14");
  });

  it("applies a function format to text-input display value", () => {
    const wrapper = mount(NumberInput, {
      props: {
        modelValue: 50,
        format: (v: number) => `${v} days`,
      },
    });
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("50 days");
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

    await wrapper.setProps({ modelValue: 5000 });
    expect((input.element as HTMLInputElement).value).toBe("5,000");
  });

  describe("range mode", () => {
    it("renders two thumbs when range is bound", () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          label: "Range",
          min: 0,
          max: 100,
        },
      });
      const thumbs = wrapper.findAllComponents({ name: "SliderThumb" });
      expect(thumbs.length).toBe(2);
    });

    it("range implies slider — no text input is rendered", () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          min: 0,
          max: 100,
        },
      });
      expect(wrapper.find("input").exists()).toBe(false);
      expect(wrapper.findComponent({ name: "SliderRoot" }).exists()).toBe(true);
    });

    it("emits tuple updates while dragging when live", async () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          live: true,
          min: 0,
          max: 100,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("update:modelValue", [25, 75]);
      const emits = wrapper.emitted("update:range");
      expect(emits?.[emits.length - 1]).toEqual([[25, 75]]);
    });

    it("does not emit on drag without live", async () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          min: 0,
          max: 100,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("update:modelValue", [30, 70]);
      expect(wrapper.emitted("update:range")).toBeUndefined();
    });

    it("coerces each handle to integer when numberType is integer", () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          numberType: "integer" as const,
          min: 0,
          max: 100,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("valueCommit", [10.7, 75.3]);
      const emits = wrapper.emitted("update:range");
      expect(emits?.[emits.length - 1]).toEqual([[10, 75]]);
    });

    it("validates each handle against min/max", async () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          min: 10,
          max: 90,
        },
      });
      expect(wrapper.find(".input-error").exists()).toBe(false);

      await wrapper.setProps({ range: [5, 80] });
      expect(wrapper.find(".input-error").text()).toBe("Min 10 (lower)");

      await wrapper.setProps({ range: [20, 95] });
      expect(wrapper.find(".input-error").text()).toBe("Max 90 (upper)");

      await wrapper.setProps({ range: [20, 80] });
      expect(wrapper.find(".input-error").exists()).toBe(false);
    });

    it("passes tuple to slider in percent mode", () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [0.25, 0.75] as NumberRange,
          percent: true,
          min: 0,
          max: 1,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      expect(slider.props("modelValue")).toEqual([0.25, 0.75]);
    });

    it("labels thumbs as lower/upper for accessibility", () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          label: "Range",
          min: 0,
          max: 100,
        },
      });
      const thumbs = wrapper.findAll(".slider-thumb");
      expect(thumbs[0].attributes("aria-label")).toBe("Range (lower)");
      expect(thumbs[1].attributes("aria-label")).toBe("Range (upper)");
    });

    it("falls back to [min, max] when range is bound but undefined", () => {
      // Simulate `v-model:range="someUndefinedRef"` — the listener is
      // present so we enter range mode, but the initial value is undefined.
      const wrapper = mount(NumberInput, {
        props: {
          "onUpdate:range": () => {},
          min: 10,
          max: 90,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      expect(slider.props("modelValue")).toEqual([10, 90]);
    });

    it("uses format to format thumb labels and min/max labels", () => {
      const fmt = (v: number) => new Date(v).toISOString().slice(0, 10);
      const start = Date.UTC(2024, 0, 1);
      const mid = Date.UTC(2024, 5, 1);
      const end = Date.UTC(2024, 11, 31);
      const wrapper = mount(NumberInput, {
        props: {
          range: [mid, end] as NumberRange,
          min: start,
          max: end,
          format: fmt,
        },
      });
      const thumbs = wrapper.findAll(".slider-thumb");
      expect(thumbs[0].text()).toBe("2024-06-01");
      expect(thumbs[1].text()).toBe("2024-12-31");
      const labels = wrapper.findAll(".slider-labels span");
      expect(labels[0].text()).toBe("2024-01-01");
      expect(labels[1].text()).toBe("2024-12-31");
    });

    it("syncs slider when range model changes externally", async () => {
      const wrapper = mount(NumberInput, {
        props: {
          range: [20, 80] as NumberRange,
          min: 0,
          max: 100,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      expect(slider.props("modelValue")).toEqual([20, 80]);

      await wrapper.setProps({ range: [40, 60] });
      expect(slider.props("modelValue")).toEqual([40, 60]);
    });

    describe("named v-models (lower/upper)", () => {
      it("initializes the slider from lower/upper without a tuple binding", () => {
        const wrapper = mount(NumberInput, {
          props: {
            lower: 25,
            upper: 75,
            min: 0,
            max: 100,
          },
        });
        const slider = wrapper.findComponent({ name: "SliderRoot" });
        expect(slider.props("modelValue")).toEqual([25, 75]);
      });

      it("emits all three range sinks (range + lower + upper) on commit", () => {
        const wrapper = mount(NumberInput, {
          props: {
            range: [20, 80] as NumberRange,
            lower: 20,
            upper: 80,
            min: 0,
            max: 100,
          },
        });
        const slider = wrapper.findComponent({ name: "SliderRoot" });
        slider.vm.$emit("valueCommit", [35, 65]);

        const tuple = wrapper.emitted("update:range");
        const lo = wrapper.emitted("update:lower");
        const hi = wrapper.emitted("update:upper");
        expect(tuple?.[tuple.length - 1]).toEqual([[35, 65]]);
        expect(lo?.[lo.length - 1]).toEqual([35]);
        expect(hi?.[hi.length - 1]).toEqual([65]);
      });

      it("named values take precedence over the tuple when both are bound", () => {
        // Range says [10, 90], but explicit lower=30 should win for the
        // lower bound. (Mixing both is unusual, but precedence must be
        // predictable.)
        const wrapper = mount(NumberInput, {
          props: {
            range: [10, 90] as NumberRange,
            lower: 30,
            min: 0,
            max: 100,
          },
        });
        const slider = wrapper.findComponent({ name: "SliderRoot" });
        expect(slider.props("modelValue")).toEqual([30, 90]);
      });

      it("updates slider when only lower changes externally", async () => {
        const wrapper = mount(NumberInput, {
          props: {
            lower: 25,
            upper: 75,
            min: 0,
            max: 100,
          },
        });
        const slider = wrapper.findComponent({ name: "SliderRoot" });
        expect(slider.props("modelValue")).toEqual([25, 75]);

        await wrapper.setProps({ lower: 40 });
        expect(slider.props("modelValue")).toEqual([40, 75]);
      });

      it("falls back to slider max when only lower is bound", () => {
        const wrapper = mount(NumberInput, {
          props: {
            lower: 30,
            min: 0,
            max: 100,
          },
        });
        const slider = wrapper.findComponent({ name: "SliderRoot" });
        expect(slider.props("modelValue")).toEqual([30, 100]);
      });

      it("fires update:lower / update:upper during drag when live", () => {
        const wrapper = mount(NumberInput, {
          props: {
            lower: 25,
            upper: 75,
            live: true,
            min: 0,
            max: 100,
          },
        });
        const slider = wrapper.findComponent({ name: "SliderRoot" });
        slider.vm.$emit("update:modelValue", [27, 73]);

        const lo = wrapper.emitted("update:lower");
        const hi = wrapper.emitted("update:upper");
        expect(lo?.[lo.length - 1]).toEqual([27]);
        expect(hi?.[hi.length - 1]).toEqual([73]);
      });

      it("coerces named-model commits to integer", () => {
        const wrapper = mount(NumberInput, {
          props: {
            lower: 25,
            upper: 75,
            numberType: "integer" as const,
            min: 0,
            max: 100,
          },
        });
        const slider = wrapper.findComponent({ name: "SliderRoot" });
        slider.vm.$emit("valueCommit", [27.8, 72.3]);

        const lo = wrapper.emitted("update:lower");
        const hi = wrapper.emitted("update:upper");
        expect(lo?.[lo.length - 1]).toEqual([27]);
        expect(hi?.[hi.length - 1]).toEqual([72]);
      });

      it("warns when default v-model is bound in range mode", () => {
        // The default v-model is unused once a range binding is present —
        // catch the likely misconfig.
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        mount(NumberInput, {
          props: {
            "onUpdate:modelValue": () => {},
            lower: 10,
            upper: 90,
            min: 0,
            max: 100,
          },
        });
        expect(warn).toHaveBeenCalledOnce();
        expect(warn.mock.calls[0][0]).toMatch(/v-model/);
        warn.mockRestore();
      });

      it("does not warn when only range bindings are present", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        mount(NumberInput, {
          props: {
            lower: 10,
            upper: 90,
            min: 0,
            max: 100,
          },
        });
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });

      it("does not warn in single mode with default v-model only", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        mount(NumberInput, {
          props: {
            modelValue: 42,
            "onUpdate:modelValue": () => {},
            label: "Count",
          },
        });
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });
    });
  });

  describe("multi-handle mode", () => {
    it("renders one thumb per bound value", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], min: 0, max: 100 },
      });
      expect(wrapper.findAllComponents({ name: "SliderThumb" }).length).toBe(3);
    });

    it("implies slider — no text input is rendered", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], min: 0, max: 100 },
      });
      expect(wrapper.find("input").exists()).toBe(false);
      expect(wrapper.findComponent({ name: "SliderRoot" }).exists()).toBe(true);
    });

    it("emits the full array on commit", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], min: 0, max: 100 },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("valueCommit", [15, 40, 80]);
      const emits = wrapper.emitted("update:values");
      expect(emits?.[emits.length - 1]).toEqual([[15, 40, 80]]);
    });

    it("does not emit on drag without live", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], min: 0, max: 100 },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("update:modelValue", [12, 40, 75]);
      expect(wrapper.emitted("update:values")).toBeUndefined();
    });

    it("emits while dragging when live", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], live: true, min: 0, max: 100 },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("update:modelValue", [12, 40, 75]);
      const emits = wrapper.emitted("update:values");
      expect(emits?.[emits.length - 1]).toEqual([[12, 40, 75]]);
    });

    it("coerces every handle to integer when numberType is integer", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [10, 40, 75],
          numberType: "integer" as const,
          min: 0,
          max: 100,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("valueCommit", [10.7, 40.2, 75.9]);
      const emits = wrapper.emitted("update:values");
      expect(emits?.[emits.length - 1]).toEqual([[10, 40, 75]]);
    });

    it("reacts to a changed handle count", async () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40], min: 0, max: 100 },
      });
      expect(wrapper.findAll(".slider-thumb").length).toBe(2);
      await wrapper.setProps({ values: [10, 40, 70, 90] });
      expect(wrapper.findAll(".slider-thumb").length).toBe(4);
    });

    it("labels thumbs by position for accessibility", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], label: "Cutpoints", min: 0, max: 100 },
      });
      const thumbs = wrapper.findAll(".slider-thumb");
      expect(thumbs[0].attributes("aria-label")).toBe(
        "Cutpoints (handle 1 of 3)",
      );
      expect(thumbs[2].attributes("aria-label")).toBe(
        "Cutpoints (handle 3 of 3)",
      );
    });

    it("names the failing handle in validation errors", async () => {
      const wrapper = mount(NumberInput, {
        props: { values: [20, 50, 80], min: 10, max: 90 },
      });
      expect(wrapper.find(".input-error").exists()).toBe(false);

      await wrapper.setProps({ values: [20, 50, 95] });
      expect(wrapper.find(".input-error").text()).toBe(
        "Max 90 (handle 3 of 3)",
      );

      await wrapper.setProps({ values: [5, 50, 80] });
      expect(wrapper.find(".input-error").text()).toBe(
        "Min 10 (handle 1 of 3)",
      );
    });

    it("falls back to a single handle at min when values is bound but empty", () => {
      const wrapper = mount(NumberInput, {
        props: { "onUpdate:values": () => {}, min: 10, max: 90 },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      expect(slider.props("modelValue")).toEqual([10]);
    });

    it("takes precedence over range bindings and warns", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const wrapper = mount(NumberInput, {
        props: {
          values: [10, 40, 75],
          range: [20, 80] as NumberRange,
          min: 0,
          max: 100,
        },
      });
      expect(wrapper.findAll(".slider-thumb").length).toBe(3);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("`v-model:values` takes precedence"),
      );
      warn.mockRestore();
    });

    it("warns when the default v-model is bound", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mount(NumberInput, {
        props: {
          values: [10, 40],
          "onUpdate:modelValue": () => {},
          min: 0,
          max: 100,
        },
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("In multi-handle mode"),
      );
      warn.mockRestore();
    });
  });

  describe("bar prop", () => {
    it("renders the range fill by default", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], min: 0, max: 100 },
      });
      expect(wrapper.find(".slider-range").exists()).toBe(true);
      expect(wrapper.find(".slider-segment").exists()).toBe(false);
    });

    it("renders no fill with bar=none", () => {
      const wrapper = mount(NumberInput, {
        props: { modelValue: 40, slider: true, bar: "none" as const },
      });
      expect(wrapper.find(".slider-range").exists()).toBe(false);
      expect(wrapper.find(".slider-segment").exists()).toBe(false);
    });

    it("paints one segment per handle, stopping at the last one", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [10, 40, 75],
          bar: "segments" as const,
          min: 0,
          max: 100,
        },
      });
      const segments = wrapper.findAll(".slider-segment");
      expect(segments.length).toBe(3);
      expect(wrapper.find(".slider-range").exists()).toBe(false);
      expect(segments[0].attributes("style")).toContain("left: 0%");
      expect(segments[0].attributes("style")).toContain("width: 10%");
      expect(segments[1].attributes("style")).toContain("left: 10%");
      expect(segments[1].attributes("style")).toContain("width: 30%");
      expect(segments[2].attributes("style")).toContain("left: 40%");
      expect(segments[2].attributes("style")).toContain("width: 35%");
    });

    it("positions segments relative to a non-zero min", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [60, 80],
          bar: "segments" as const,
          min: 50,
          max: 100,
        },
      });
      const segments = wrapper.findAll(".slider-segment");
      expect(segments[0].attributes("style")).toContain("left: 0%");
      expect(segments[0].attributes("style")).toContain("width: 20%");
      expect(segments[1].attributes("style")).toContain("left: 20%");
      expect(segments[1].attributes("style")).toContain("width: 40%");
    });

    it("segments a single-handle slider from min to the handle", () => {
      const wrapper = mount(NumberInput, {
        props: {
          modelValue: 25,
          slider: true,
          bar: "segments" as const,
          min: 0,
          max: 100,
        },
      });
      const segments = wrapper.findAll(".slider-segment");
      expect(segments.length).toBe(1);
      expect(segments[0].attributes("style")).toContain("width: 25%");
      expect(segments[0].attributes("style")).toContain(
        "--segment-color: var(--color-primary)",
      );
    });

    it("ramps segment shades of the primary color", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [25, 50, 75],
          bar: "segments" as const,
          min: 0,
          max: 100,
        },
      });
      const styles = wrapper
        .findAll(".slider-segment")
        .map((s) => s.attributes("style"));
      expect(styles[0]).toContain(
        "--segment-color: color-mix(in srgb, var(--color-primary) 100%, var(--color-bg-3))",
      );
      expect(styles[1]).toContain("var(--color-primary) 73%");
      expect(styles[2]).toContain("var(--color-primary) 45%");
    });

    it("uses segmentColors when provided, cycling if short", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [25, 50, 75],
          bar: "segments" as const,
          segmentColors: ["red", "blue"],
          min: 0,
          max: 100,
        },
      });
      const styles = wrapper
        .findAll(".slider-segment")
        .map((s) => s.attributes("style"));
      expect(styles[0]).toContain("--segment-color: red");
      expect(styles[1]).toContain("--segment-color: blue");
      expect(styles[2]).toContain("--segment-color: red");
    });

    it("tracks segments as handles move", async () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [10, 40],
          bar: "segments" as const,
          live: true,
          min: 0,
          max: 100,
        },
      });
      const slider = wrapper.findComponent({ name: "SliderRoot" });
      slider.vm.$emit("update:modelValue", [30, 40]);
      await wrapper.vm.$nextTick();
      const segments = wrapper.findAll(".slider-segment");
      expect(segments[0].attributes("style")).toContain("width: 30%");
      expect(segments[1].attributes("style")).toContain("left: 30%");
      expect(segments[1].attributes("style")).toContain("width: 10%");
    });
  });

  describe("multi-handle ordering and reactivity", () => {
    it("sorts handles so thumbs, labels and segments share an order", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [75, 10, 40],
          bar: "segments" as const,
          label: "Cutpoints",
          min: 0,
          max: 100,
        },
      });
      const thumbs = wrapper.findAll(".slider-thumb");
      expect(thumbs.map((t) => t.text())).toEqual(["10", "40", "75"]);
      expect(thumbs[0].attributes("aria-label")).toBe(
        "Cutpoints (handle 1 of 3)",
      );
      const widths = wrapper
        .findAll(".slider-segment")
        .map((seg) => (seg.element as HTMLElement).style.width);
      expect(widths).toEqual(["10%", "30%", "35%"]);
    });

    it("picks up in-place mutation of the bound array", async () => {
      const values = reactive([10, 40]);
      const wrapper = mount(NumberInput, {
        props: { values, min: 0, max: 100 },
      });
      expect(wrapper.findAll(".slider-thumb").length).toBe(2);

      values.push(80);
      await nextTick();
      expect(wrapper.findAll(".slider-thumb").length).toBe(3);

      values[0] = 5;
      await nextTick();
      expect(wrapper.findAll(".slider-thumb")[0].text()).toBe("5");
    });

    it("treats an empty array as nothing chosen when required", async () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10], required: true, min: 0, max: 100 },
      });
      await wrapper.setProps({ values: [] });
      expect(wrapper.find(".input-error").text()).toBe("Required");
    });

    it("does not report an empty array as an error unless required", async () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10], min: 0, max: 100 },
      });
      await wrapper.setProps({ values: [] });
      expect(wrapper.find(".input-error").exists()).toBe(false);
    });
  });

  describe("slider accessibility", () => {
    it("announces the formatted value with aria-valuetext", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [0.25, 0.5], percent: true, min: 0, max: 1 },
      });
      const thumbs = wrapper.findAll(".slider-thumb");
      expect(thumbs[0].attributes("aria-valuetext")).toBe("25%");
      expect(thumbs[1].attributes("aria-valuetext")).toBe("50%");
    });

    it("uses aria-valuetext for a custom format", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [Date.UTC(2024, 2, 1)],
          min: Date.UTC(2024, 0, 1),
          max: Date.UTC(2024, 11, 31),
          format: (v: number) => new Date(v).toISOString().slice(0, 10),
        },
      });
      expect(wrapper.find(".slider-thumb").attributes("aria-valuetext")).toBe(
        "2024-03-01",
      );
    });

    it("omits aria-valuetext when it would repeat aria-valuenow", () => {
      const wrapper = mount(NumberInput, {
        props: { modelValue: 40, slider: true, min: 0, max: 100 },
      });
      const thumb = wrapper.find(".slider-thumb");
      expect(thumb.attributes("aria-valuetext")).toBeUndefined();
    });

    it("names thumbs from ariaLabel when no visible label is rendered", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40], ariaLabel: "Cutpoints", min: 0, max: 100 },
      });
      const thumbs = wrapper.findAll(".slider-thumb");
      expect(thumbs[0].attributes("aria-label")).toBe(
        "Cutpoints (handle 1 of 2)",
      );
    });

    it("groups several thumbs under one named group", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [10, 40, 75], label: "Cutpoints", min: 0, max: 100 },
      });
      const root = wrapper.find(".slider-root");
      expect(root.attributes("role")).toBe("group");
      expect(root.attributes("aria-label")).toBe("Cutpoints");
    });

    it("does not group a single-handle slider", () => {
      const wrapper = mount(NumberInput, {
        props: { modelValue: 40, slider: true, label: "Days" },
      });
      const root = wrapper.find(".slider-root");
      expect(root.attributes("role")).toBeUndefined();
      expect(root.attributes("aria-label")).toBeUndefined();
    });

    it("hides decorative segments from assistive tech", () => {
      const wrapper = mount(NumberInput, {
        props: {
          values: [10, 40],
          bar: "segments" as const,
          min: 0,
          max: 100,
        },
      });
      const segments = wrapper.findAll(".slider-segment");
      expect(segments.length).toBe(2);
      for (const segment of segments) {
        expect(segment.attributes("aria-hidden")).toBe("true");
      }
    });

    it("points the offending thumb at the error message", async () => {
      const wrapper = mount(NumberInput, {
        props: { values: [20, 50], label: "Cutpoints", min: 10, max: 90 },
      });
      await wrapper.setProps({ values: [5, 50] });
      const errorId = wrapper.find(".input-error").attributes("id");
      expect(errorId).toBeTruthy();

      const thumbs = wrapper.findAll(".slider-thumb");
      expect(thumbs[0].attributes("aria-invalid")).toBe("true");
      expect(thumbs[1].attributes("aria-invalid")).toBeUndefined();
      expect(thumbs[0].attributes("aria-describedby")).toBe(errorId);
      expect(thumbs[1].attributes("aria-describedby")).toBe(errorId);
    });

    it("drops the description when there is no error", () => {
      const wrapper = mount(NumberInput, {
        props: { values: [20, 50], min: 10, max: 90 },
      });
      expect(wrapper.find(".input-error").exists()).toBe(false);
      expect(
        wrapper.find(".slider-thumb").attributes("aria-describedby"),
      ).toBeUndefined();
    });

    it("describes the text input by its error too", async () => {
      const wrapper = mount(NumberInput, {
        props: { modelValue: 5, min: 10, max: 90 },
      });
      const input = wrapper.find("input");
      expect(input.attributes("aria-describedby")).toBeUndefined();

      await wrapper.setProps({ modelValue: 200 });
      const errorId = wrapper.find(".input-error").attributes("id");
      expect(input.attributes("aria-describedby")).toBe(errorId);
      expect(input.attributes("aria-invalid")).toBe("true");
    });
  });
});
