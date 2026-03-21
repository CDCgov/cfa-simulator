import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Button from "./Button.vue";

describe("Button", () => {
  it("renders with default slot content", () => {
    const wrapper = mount(Button, {
      slots: { default: "Click me" },
    });
    expect(wrapper.text()).toBe("Click me");
    expect(wrapper.element.tagName).toBe("BUTTON");
  });

  it("renders with label prop", () => {
    const wrapper = mount(Button, {
      props: { label: "Submit" },
    });
    expect(wrapper.text()).toBe("Submit");
  });

  it("emits click event", async () => {
    const wrapper = mount(Button, {
      slots: { default: "Click me" },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("renders as different element via as prop", () => {
    const wrapper = mount(Button, {
      props: { as: "a" },
      slots: { default: "Link" },
    });
    expect(wrapper.element.tagName).toBe("A");
  });
});
