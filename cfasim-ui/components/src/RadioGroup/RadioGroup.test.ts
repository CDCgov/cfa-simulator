import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RadioGroup from "./RadioGroup.vue";

const options = [
  { value: "sir", label: "SIR" },
  { value: "seir", label: "SEIR", description: "Adds an exposed stage" },
  { value: "agent", label: "Agent-based", disabled: true },
];

describe("RadioGroup", () => {
  it("renders a named radiogroup with one labeled radio per option", () => {
    const wrapper = mount(RadioGroup, {
      props: { options, label: "Model type", modelValue: "sir" },
    });
    const group = wrapper.find('[role="radiogroup"]');
    const label = wrapper.find(".radio-group-label");
    expect(label.element.tagName).toBe("SPAN");
    expect(group.attributes("aria-labelledby")).toBe(label.attributes("id"));

    const radios = wrapper.findAll('[role="radio"]');
    const labels = wrapper.findAll("label.cfasim-choice-label");
    expect(radios).toHaveLength(3);
    expect(labels.map((l) => l.text())).toEqual(["SIR", "SEIR", "Agent-based"]);
    radios.forEach((radio, i) => {
      expect(labels[i].attributes("for")).toBe(radio.attributes("id"));
    });
    expect(radios[0].attributes("aria-checked")).toBe("true");
    expect(radios[1].attributes("aria-checked")).toBe("false");
  });

  it("uses aria-label without a visible label", () => {
    const wrapper = mount(RadioGroup, {
      props: { options, ariaLabel: "Model type" },
    });
    expect(wrapper.find(".radio-group-label").exists()).toBe(false);
    expect(wrapper.find('[role="radiogroup"]').attributes("aria-label")).toBe(
      "Model type",
    );
  });

  it("emits the clicked value", async () => {
    const wrapper = mount(RadioGroup, {
      props: {
        options,
        modelValue: "sir",
        "onUpdate:modelValue": (v: string | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const radios = wrapper.findAll('[role="radio"]');
    await radios[1].trigger("click");
    expect(wrapper.props("modelValue")).toBe("seir");
    expect(radios[1].attributes("data-state")).toBe("checked");
    expect(radios[0].attributes("data-state")).toBe("unchecked");
  });

  it("links a description and disables an option", () => {
    const wrapper = mount(RadioGroup, {
      props: { options, modelValue: "sir" },
    });
    const radios = wrapper.findAll('[role="radio"]');
    const description = wrapper.find(".cfasim-choice-description");
    expect(description.text()).toBe("Adds an exposed stage");
    expect(radios[1].attributes("aria-describedby")).toBe(
      description.attributes("id"),
    );
    expect(radios[0].attributes("aria-describedby")).toBeUndefined();
    expect(radios[2].attributes("data-disabled")).toBeDefined();
    expect(radios[2].attributes("disabled")).toBeDefined();
  });

  it("lays out horizontally on request", () => {
    const wrapper = mount(RadioGroup, {
      props: { options, orientation: "horizontal" },
    });
    const group = wrapper.find(".radio-group");
    expect(group.classes()).toContain("radio-group--horizontal");
    expect(group.attributes("aria-orientation")).toBe("horizontal");
  });
});
