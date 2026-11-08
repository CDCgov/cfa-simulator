import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Checkbox from "./Checkbox.vue";

describe("Checkbox", () => {
  it("labels the checkbox with a <label for>", () => {
    const wrapper = mount(Checkbox, {
      props: { label: "Isolate cases", modelValue: false },
    });
    const box = wrapper.find('[role="checkbox"]');
    const label = wrapper.find("label");
    expect(label.text()).toBe("Isolate cases");
    expect(box.attributes("id")).toBeTruthy();
    expect(label.attributes("for")).toBe(box.attributes("id"));
    expect(box.attributes("aria-checked")).toBe("false");
  });

  it("toggles on click", async () => {
    const wrapper = mount(Checkbox, {
      props: {
        label: "Isolate cases",
        modelValue: false,
        "onUpdate:modelValue": (v: boolean | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const box = wrapper.find('[role="checkbox"]');
    await box.trigger("click");
    expect(wrapper.props("modelValue")).toBe(true);
    expect(box.attributes("data-state")).toBe("checked");
    await box.trigger("click");
    expect(wrapper.props("modelValue")).toBe(false);
  });

  it("shows a dash for indeterminate and emits true on the next click", async () => {
    const wrapper = mount(Checkbox, {
      props: {
        label: "All regions",
        modelValue: false,
        indeterminate: true,
        "onUpdate:modelValue": (v: boolean | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const box = wrapper.find('[role="checkbox"]');
    expect(box.attributes("aria-checked")).toBe("mixed");
    expect(box.attributes("data-state")).toBe("indeterminate");
    expect(wrapper.find("path").attributes("d")).toBe("M3.5 8h9");
    await box.trigger("click");
    expect(wrapper.props("modelValue")).toBe(true);
  });

  it("links the description with aria-describedby", () => {
    const wrapper = mount(Checkbox, {
      props: {
        label: "Isolate cases",
        description: "Symptomatic individuals stay home",
      },
    });
    const box = wrapper.find('[role="checkbox"]');
    const description = wrapper.find(".cfasim-choice-description");
    expect(description.text()).toBe("Symptomatic individuals stay home");
    expect(box.attributes("aria-describedby")).toBe(
      description.attributes("id"),
    );
  });

  it("renders disabled", () => {
    const wrapper = mount(Checkbox, {
      props: { label: "Locked", disabled: true },
    });
    expect(
      wrapper.find('[role="checkbox"]').attributes("data-disabled"),
    ).toBeDefined();
    expect(
      wrapper.find(".cfasim-choice").attributes("data-disabled"),
    ).toBeDefined();
  });
});
