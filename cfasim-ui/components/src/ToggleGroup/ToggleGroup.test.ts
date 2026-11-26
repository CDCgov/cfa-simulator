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

  it("exposes the variant on the group, primary by default", () => {
    const group = (variant?: "secondary" | "neutral") =>
      mount(ToggleGroup, { props: { options, variant } }).find(".toggle-group");
    expect(group().attributes("data-variant")).toBe("primary");
    expect(group("neutral").attributes("data-variant")).toBe("neutral");
  });

  it("is borderless unless given borders", () => {
    const group = (borders?: boolean) =>
      mount(ToggleGroup, { props: { options, borders } }).find(".toggle-group");
    expect(group().attributes("data-borders")).toBeUndefined();
    expect(group(true).attributes("data-borders")).toBeDefined();
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

  it("keeps the selection when required", async () => {
    const single = mount(ToggleGroup, {
      props: {
        options,
        required: true,
        modelValue: "left",
        "onUpdate:modelValue": (v: string | string[] | undefined) =>
          single.setProps({ modelValue: v }),
      },
    });
    const left = single.findAll(".toggle-group-item")[0];
    await left.trigger("click");
    expect(single.props("modelValue")).toBe("left");
    expect(left.attributes("data-state")).toBe("on");
    await single.findAll(".toggle-group-item")[1].trigger("click");
    expect(single.props("modelValue")).toBe("center");

    const multiple = mount(ToggleGroup, {
      props: {
        options,
        required: true,
        multiple: true,
        modelValue: ["left", "right"],
        "onUpdate:modelValue": (v: string | string[] | undefined) =>
          multiple.setProps({ modelValue: v }),
      },
    });
    const items = multiple.findAll(".toggle-group-item");
    await items[0].trigger("click");
    expect(multiple.props("modelValue")).toEqual(["right"]);
    await items[2].trigger("click");
    expect(multiple.props("modelValue")).toEqual(["right"]);
    expect(items[2].attributes("data-state")).toBe("on");
  });

  it("stays pressed when required with no initial value", async () => {
    const wrapper = mount(ToggleGroup, { props: { options, required: true } });
    const left = wrapper.findAll(".toggle-group-item")[0];
    await left.trigger("click");
    await left.trigger("click");
    expect(left.attributes("data-state")).toBe("on");
    expect(wrapper.emitted("update:modelValue")).toEqual([["left"]]);
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
    const label = wrapper.find(".toggle-group-label");
    expect(label.text()).toContain("Alignment");
    // No labelable control, so a span named by aria-labelledby, not a
    // <label> that would adopt the Hint button as its control.
    expect(label.element.tagName).toBe("SPAN");
    expect(wrapper.find(".toggle-group").attributes("aria-labelledby")).toBe(
      label.attributes("id"),
    );
    const right = wrapper.findAll(".toggle-group-item")[1];
    expect(right.attributes("data-disabled")).toBeDefined();
  });
});
