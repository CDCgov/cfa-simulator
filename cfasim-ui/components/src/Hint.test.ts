import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Hint from "./Hint.vue";

describe("Hint", () => {
  it("renders a trigger button with help icon", () => {
    const wrapper = mount(Hint, {
      props: { text: "Some hint text" },
    });

    const button = wrapper.find(".HintTrigger");
    expect(button.exists()).toBe(true);
    expect(button.attributes("aria-label")).toBe("More info");
    expect(button.attributes("type")).toBe("button");
  });

  it("renders the help icon inside the trigger", () => {
    const wrapper = mount(Hint, {
      props: { text: "Some hint text" },
    });

    const icon = wrapper.find(".HintTrigger .Icon");
    expect(icon.exists()).toBe(true);
    expect(icon.text()).toBe("help");
  });

  it("does not show tooltip content by default", () => {
    const wrapper = mount(Hint, {
      props: { text: "Hidden until hover" },
    });

    expect(wrapper.text()).not.toContain("Hidden until hover");
  });
});
