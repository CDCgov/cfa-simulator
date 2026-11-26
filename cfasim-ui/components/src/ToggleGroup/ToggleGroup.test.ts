import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ToggleGroup from "./ToggleGroup.vue";

const options = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

describe("ToggleGroup", () => {
  it("updates single and multiple selections on click", async () => {
    const single = mount(ToggleGroup, {
      props: {
        options,
        modelValue: "left",
        "onUpdate:modelValue": (value: string | string[] | undefined) =>
          single.setProps({ modelValue: value }),
      },
    });
    await single.findAll(".toggle-group-item")[2].trigger("click");
    expect(single.props("modelValue")).toBe("right");

    const multi = mount(ToggleGroup, {
      props: {
        options,
        multiple: true,
        modelValue: ["left"],
        "onUpdate:modelValue": (value: string | string[] | undefined) =>
          multi.setProps({ modelValue: value }),
      },
    });
    const items = multi.findAll(".toggle-group-item");
    await items[2].trigger("click");
    expect(multi.props("modelValue")).toEqual(["left", "right"]);
    await items[0].trigger("click");
    expect(multi.props("modelValue")).toEqual(["right"]);
  });

  it("prevents deselecting the last item when required", async () => {
    const required = mount(ToggleGroup, {
      props: { options, required: true },
    });
    const left = required.findAll(".toggle-group-item")[0];
    await left.trigger("click");
    await left.trigger("click");
    expect(left.attributes("data-state")).toBe("on");
    expect(required.emitted("update:modelValue")).toEqual([["left"]]);

    const multiRequired = mount(ToggleGroup, {
      props: {
        options,
        required: true,
        multiple: true,
        modelValue: ["left", "right"],
        "onUpdate:modelValue": (value: string | string[] | undefined) =>
          multiRequired.setProps({ modelValue: value }),
      },
    });
    const items = multiRequired.findAll(".toggle-group-item");
    await items[0].trigger("click");
    expect(multiRequired.props("modelValue")).toEqual(["right"]);
    await items[2].trigger("click");
    expect(multiRequired.props("modelValue")).toEqual(["right"]);
  });
});
