import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import NumberInput, { type NumberRange } from "./NumberInput.vue";

function mountControlled(props: Record<string, unknown> = {}) {
  const wrapper = mount(NumberInput, {
    props: {
      modelValue: 100,
      label: "Count",
      "onUpdate:modelValue": (value: number | undefined) =>
        wrapper.setProps({ modelValue: value }),
      ...props,
    },
  });
  return wrapper;
}

describe("NumberInput", () => {
  it("commits on blur and Enter, strips junk, and resets on all-invalid input", async () => {
    const wrapper = mountControlled({ modelValue: 42 });
    const input = wrapper.find("input");
    const element = input.element as HTMLInputElement;

    await input.setValue("abc12x3");
    expect(wrapper.props("modelValue")).toBe(42);
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(123);

    await input.setValue("1e6");
    await input.trigger("keydown.enter");
    expect(wrapper.props("modelValue")).toBe(1_000_000);

    await input.setValue("-10");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(-10);

    // Pure garbage must not collapse to 0 and should restore the formatted model.
    await input.setValue("abcxyz");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(-10);
    expect(element.value).toBe("-10");
  });

  it("enforces required and allows clearing when optional", async () => {
    const optional = mountControlled({ modelValue: 42 });
    await optional.find("input").setValue("");
    await optional.find("input").trigger("blur");
    expect(optional.props("modelValue")).toBeUndefined();
    expect(optional.find(".input-error").exists()).toBe(false);

    vi.useFakeTimers();
    try {
      const required = mountControlled({
        modelValue: 42,
        required: true,
        live: true,
      });
      const input = required.find("input");
      await input.setValue("");
      vi.advanceTimersByTime(400);
      await input.trigger("blur");
      expect(required.props("modelValue")).toBe(42);
      expect(required.find(".input-error").text()).toBe("Required");
      expect(input.attributes("aria-invalid")).toBe("true");

      await required.setProps({ modelValue: undefined });
      expect(required.find(".input-error").text()).toBe("Required");

      await input.setValue("7");
      await input.trigger("blur");
      expect(required.props("modelValue")).toBe(7);
      expect(required.find(".input-error").exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("validates min and max on commit and programmatic updates", async () => {
    const wrapper = mountControlled({ modelValue: 50, min: 10, max: 100 });
    const input = wrapper.find("input");

    await input.setValue("200");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(50);
    expect(wrapper.find(".input-error").text()).toBe("Max 100");

    await input.setValue("5");
    await input.trigger("blur");
    expect(wrapper.find(".input-error").text()).toBe("Min 10");

    await wrapper.setProps({ modelValue: 500 });
    expect(wrapper.find(".input-error").text()).toBe("Max 100");

    await input.setValue("80");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(80);
    expect(wrapper.find(".input-error").exists()).toBe(false);
  });

  it("scales display, commit, bounds, and inferred decimals in percent mode", async () => {
    const wrapper = mountControlled({
      modelValue: 0.5,
      percent: true,
      max: 0.99,
      step: 0.007,
    });
    const input = wrapper.find("input");
    // 0.007 * 100 has float noise; inferred precision must stay at 1 decimal.
    expect((input.element as HTMLInputElement).value).toBe("50.0");

    await input.setValue("85");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBeCloseTo(0.85);

    await input.setValue("100");
    await input.trigger("blur");
    expect(wrapper.find(".input-error").text()).toBe("Max 99%");

    await input.setValue("-5");
    await input.trigger("blur");
    expect(wrapper.find(".input-error").text()).toBe("Min 0%");
  });

  it("formats commas, preserves in-progress decimals, and handles numberType/format", async () => {
    const wrapper = mountControlled({ modelValue: 1_500 });
    const input = wrapper.find("input");
    const element = input.element as HTMLInputElement;
    expect(element.value).toBe("1,500");

    await input.setValue("1,234,567");
    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe(1_234_567);

    element.value = "15.60";
    await input.trigger("input");
    expect(element.value).toBe("15.60");

    const integerInput = mountControlled({
      modelValue: 0.5,
      percent: true,
      numberType: "integer" as const,
    });
    await integerInput.find("input").setValue("42.7");
    await integerInput.find("input").trigger("blur");
    expect(integerInput.props("modelValue")).toBeCloseTo(0.42);
    expect((integerInput.find("input").element as HTMLInputElement).value).toBe(
      "42",
    );

    const floatInput = mount(NumberInput, {
      props: { modelValue: 100, numberType: "float" as const },
    });
    expect((floatInput.find("input").element as HTMLInputElement).value).toBe(
      "100.0",
    );

    const formatted = mount(NumberInput, {
      props: { modelValue: 3.14159, format: "%.2f" },
    });
    expect((formatted.find("input").element as HTMLInputElement).value).toBe(
      "3.14",
    );
  });

  it("steps with ArrowUp/Down, Shift 10x, custom step, and clamps to bounds", async () => {
    const wrapper = mountControlled({ modelValue: 95, step: 5, max: 100 });
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.props("modelValue")).toBe(90);
    await input.trigger("keydown", { key: "ArrowUp", shiftKey: true });
    expect(wrapper.props("modelValue")).toBe(100);
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.props("modelValue")).toBe(100);
  });

  it("respects live mode for text input and slider dragging", async () => {
    const text = mountControlled({ modelValue: 100, live: true });
    await text.find("input").setValue("200");
    await text.find("input").trigger("change");
    expect(text.props("modelValue")).toBe(200);

    const liveUpdates: number[] = [];
    const liveSlider = mount(NumberInput, {
      props: {
        modelValue: 50,
        slider: true,
        live: true,
        min: 0,
        max: 100,
        "onUpdate:modelValue": (value: number | undefined) => {
          if (value != null) liveUpdates.push(value);
        },
      },
    });
    liveSlider
      .findComponent({ name: "SliderRoot" })
      .vm.$emit("update:modelValue", [75]);
    expect(liveUpdates).toContain(75);

    const lazyUpdates: number[] = [];
    const lazySlider = mount(NumberInput, {
      props: {
        modelValue: 50,
        slider: true,
        min: 0,
        max: 100,
        "onUpdate:modelValue": (value: number | undefined) => {
          if (value != null) lazyUpdates.push(value);
        },
      },
    });
    lazySlider
      .findComponent({ name: "SliderRoot" })
      .vm.$emit("update:modelValue", [75]);
    expect(lazyUpdates).toEqual([]);
  });

  it("supports range tuple and named lower/upper bindings with integer coercion and validation", async () => {
    const wrapper = mount(NumberInput, {
      props: {
        range: [10, 90] as NumberRange,
        lower: 30,
        upper: 80,
        numberType: "integer" as const,
        min: 10,
        max: 90,
      },
    });
    const slider = wrapper.findComponent({ name: "SliderRoot" });
    expect(slider.props("modelValue")).toEqual([30, 80]);

    slider.vm.$emit("valueCommit", [27.8, 72.3]);
    expect(wrapper.emitted("update:range")?.at(-1)).toEqual([[27, 72]]);
    expect(wrapper.emitted("update:lower")?.at(-1)).toEqual([27]);
    expect(wrapper.emitted("update:upper")?.at(-1)).toEqual([72]);

    await wrapper.setProps({ lower: 5 });
    expect(wrapper.find(".input-error").text()).toBe("Min 10 (lower)");
    await wrapper.setProps({ lower: 20, upper: 95 });
    expect(wrapper.find(".input-error").text()).toBe("Max 90 (upper)");
  });

  it("sorts multi-handle values, tracks reactive mutations, and lays out bar segments", async () => {
    const values = reactive([75, 10, 40]);
    const wrapper = mount(NumberInput, {
      props: { values, bar: "segments" as const, min: 0, max: 100 },
    });
    expect(
      wrapper.findAll(".slider-thumb").map((thumb) => thumb.text()),
    ).toEqual(["10", "40", "75"]);
    const widths = wrapper
      .findAll(".slider-segment")
      .map((segment) => (segment.element as HTMLElement).style.width);
    expect(widths).toEqual(["10%", "30%", "35%"]);

    values.push(90);
    await nextTick();
    expect(wrapper.findAll(".slider-thumb")).toHaveLength(4);

    wrapper
      .findComponent({ name: "SliderRoot" })
      .vm.$emit("valueCommit", [15, 40, 75, 90]);
    expect(wrapper.emitted("update:values")?.at(-1)).toEqual([
      [15, 40, 75, 90],
    ]);
  });

  it("snaps drags onto the step grid and jumps disabledRanges on keyboard step", async () => {
    const commits: NumberRange[] = [];
    const wrapper = mount(NumberInput, {
      attachTo: document.body,
      props: {
        range: [20, 40] as NumberRange,
        min: 0,
        max: 100,
        step: 5,
        disabledRanges: [
          [0, 22],
          [40, 60],
        ] as NumberRange[],
        "onUpdate:range": (value: NumberRange | undefined) => {
          if (value) commits.push(value);
          wrapper.setProps({ range: value });
        },
      },
    });
    const slider = wrapper.findComponent({ name: "SliderRoot" });
    slider.vm.$emit("valueCommit", [10, 40]);
    expect(commits.at(-1)).toEqual([25, 40]);
    await nextTick();

    const thumbs = wrapper.findAll(".slider-thumb");
    await thumbs[1].trigger("keydown", { key: "ArrowRight" });
    slider.vm.$emit("valueCommit", [25, 45]);
    slider.vm.$emit("update:modelValue", [25, 45]);
    expect(commits.at(-1)).toEqual([25, 60]);
    await nextTick();

    // Pointer move resets keyboard-jump mode back to nearest-edge snap.
    await thumbs[1].trigger("keydown", { key: "ArrowLeft" });
    await wrapper.find(".slider-container").trigger("pointerdown");
    slider.vm.$emit("valueCommit", [25, 55]);
    expect(commits.at(-1)).toEqual([25, 60]);
    wrapper.unmount();

    const flagged = mount(NumberInput, {
      props: {
        range: [30, 70] as NumberRange,
        min: 0,
        max: 100,
        disabledRanges: [
          [0, 20],
          [40, 60],
        ] as NumberRange[],
      },
    });
    await flagged.setProps({ range: [10, 70] });
    expect(flagged.find(".input-error").text()).toBe(
      "Unavailable: 0–20 (lower)",
    );
  });

  it("skips disabledRanges with text input arrow keys and flags blocked commits", async () => {
    const wrapper = mountControlled({
      modelValue: 40,
      disabledRanges: [[40, 60]] as NumberRange[],
    });
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.props("modelValue")).toBe(60);
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.props("modelValue")).toBe(40);
    await input.setValue("50");
    await input.trigger("blur");
    expect(wrapper.find(".input-error").text()).toBe("Unavailable: 40–60");
  });
});
