import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Box from "./Box.vue";

describe("Box", () => {
  it("renders slot content", () => {
    const wrapper = mount(Box, {
      props: { variant: "info" },
      slots: { default: "Hello" },
    });
    expect(wrapper.text()).toBe("Hello");
  });

  it.each(["info", "success", "warning", "error"] as const)(
    "applies %s variant class",
    (variant) => {
      const wrapper = mount(Box, {
        props: { variant },
        slots: { default: "Content" },
      });
      expect(wrapper.classes()).toContain(`box-${variant}`);
    },
  );

  it("applies custom role", () => {
    const wrapper = mount(Box, {
      props: { variant: "warning", role: "alert" },
      slots: { default: "Warning" },
    });
    expect(wrapper.attributes("role")).toBe("alert");
  });

  it("has no role by default", () => {
    const wrapper = mount(Box, {
      slots: { default: "Content" },
    });
    expect(wrapper.attributes("role")).toBeUndefined();
  });

  it("applies custom bgColor and textColor", () => {
    const wrapper = mount(Box, {
      props: { bgColor: "#fef3e6", textColor: "#7a3d00" },
      slots: { default: "Custom" },
    });
    const style = wrapper.attributes("style") ?? "";
    expect(style).toContain("background-color");
    expect(style).toContain("color");
  });
});
