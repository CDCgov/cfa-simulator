import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TextInput from "./TextInput.vue";

describe("TextInput", () => {
  it("renders with label", () => {
    const wrapper = mount(TextInput, {
      props: { modelValue: "hello", label: "Name" },
    });
    const label = wrapper.find("label.input-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toContain("Name");
  });

  it("renders without label", () => {
    const wrapper = mount(TextInput, {
      props: { modelValue: "hello" },
    });
    expect(wrapper.find("label").exists()).toBe(false);
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("does not emit update on typing, only on blur", async () => {
    const wrapper = mount(TextInput, {
      props: {
        modelValue: "initial",
        label: "Name",
        "onUpdate:modelValue": (v: string) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue("changed");
    expect(wrapper.props("modelValue")).toBe("initial");

    await input.trigger("blur");
    expect(wrapper.props("modelValue")).toBe("changed");
  });

  it("emits update on Enter keydown", async () => {
    const wrapper = mount(TextInput, {
      props: {
        modelValue: "initial",
        label: "Name",
        "onUpdate:modelValue": (v: string) =>
          wrapper.setProps({ modelValue: v }),
      },
    });

    const input = wrapper.find("input");
    await input.setValue("entered");
    expect(wrapper.props("modelValue")).toBe("initial");

    await input.trigger("keydown.enter");
    expect(wrapper.props("modelValue")).toBe("entered");
  });

  it("syncs local value when model changes externally", async () => {
    const wrapper = mount(TextInput, {
      props: { modelValue: "original", label: "Name" },
    });

    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("original");

    await wrapper.setProps({ modelValue: "reset" });
    expect((input.element as HTMLInputElement).value).toBe("reset");
  });
});
