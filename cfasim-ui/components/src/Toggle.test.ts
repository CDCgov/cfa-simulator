import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Toggle from "./Toggle.vue";

describe("Toggle", () => {
  it("renders with label", () => {
    const wrapper = mount(Toggle, {
      props: { label: "Dark mode" },
    });
    expect(wrapper.text()).toContain("Dark mode");
  });

  it("toggles on click", async () => {
    const wrapper = mount(Toggle, {
      props: {
        label: "Enable",
        modelValue: false,
        "onUpdate:modelValue": (e: boolean) =>
          wrapper.setProps({ modelValue: e }),
      },
    });
    const switchEl = wrapper.find("button");
    expect(switchEl.attributes("data-state")).toBe("unchecked");
    await switchEl.trigger("click");
    expect(switchEl.attributes("data-state")).toBe("checked");
  });

  it("renders as disabled", () => {
    const wrapper = mount(Toggle, {
      props: { label: "Disabled toggle", disabled: true },
    });
    const switchEl = wrapper.find("button");
    expect(switchEl.attributes("data-disabled")).toBeDefined();
  });
});
