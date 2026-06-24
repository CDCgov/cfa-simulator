import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ToggleGroup from "./ToggleGroup.vue";

const options = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

describe("ToggleGroup", () => {
  it("renders an item per option with a group role", () => {
    const wrapper = mount(ToggleGroup, {
      props: { options, ariaLabel: "Align", modelValue: "center" },
    });
    expect(wrapper.find('[role="group"]').exists()).toBe(true);
    const items = wrapper.findAll(".toggle-group-item");
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.text())).toEqual(["Left", "Center", "Right"]);
  });

  it("marks the selected value as pressed (single mode)", () => {
    const wrapper = mount(ToggleGroup, {
      props: { options, modelValue: "center" },
    });
    const [left, center] = wrapper.findAll(".toggle-group-item");
    expect(center.attributes("data-state")).toBe("on");
    expect(center.attributes("aria-pressed")).toBe("true");
    expect(left.attributes("data-state")).toBe("off");
  });

  it("emits the clicked value in single mode", async () => {
    const wrapper = mount(ToggleGroup, {
      props: {
        options,
        modelValue: "left",
        "onUpdate:modelValue": (v: string | string[] | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    await wrapper.findAll(".toggle-group-item")[2].trigger("click");
    expect(wrapper.props("modelValue")).toBe("right");
  });

  it("accumulates values in multiple mode", async () => {
    const wrapper = mount(ToggleGroup, {
      props: {
        options,
        multiple: true,
        modelValue: ["left"],
        "onUpdate:modelValue": (v: string | string[] | undefined) =>
          wrapper.setProps({ modelValue: v }),
      },
    });
    const items = wrapper.findAll(".toggle-group-item");
    await items[2].trigger("click");
    expect(wrapper.props("modelValue")).toEqual(["left", "right"]);
    await items[0].trigger("click");
    expect(wrapper.props("modelValue")).toEqual(["right"]);
  });

  it("renders a label and disables an individual option", () => {
    const wrapper = mount(ToggleGroup, {
      props: {
        label: "Alignment",
        modelValue: "left",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right", disabled: true },
        ],
      },
    });
    expect(wrapper.find(".toggle-group-label").text()).toContain("Alignment");
    const right = wrapper.findAll(".toggle-group-item")[1];
    expect(right.attributes("data-disabled")).toBeDefined();
  });
});
