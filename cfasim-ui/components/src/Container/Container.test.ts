import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Container from "./Container.vue";

describe("Container", () => {
  it("renders slot content", () => {
    const wrapper = mount(Container, {
      slots: { default: "Hello" },
    });
    expect(wrapper.text()).toBe("Hello");
  });

  it("is a vertical flex column by default", () => {
    const wrapper = mount(Container, { slots: { default: "x" } });
    expect(wrapper.classes()).toContain("container");
    expect(wrapper.classes()).not.toContain("container-horizontal");
  });

  it("applies horizontal class when horizontal=true", () => {
    const wrapper = mount(Container, {
      props: { horizontal: true },
      slots: { default: "x" },
    });
    expect(wrapper.classes()).toContain("container-horizontal");
  });

  it("applies border class when border=true", () => {
    const wrapper = mount(Container, {
      props: { border: true },
      slots: { default: "x" },
    });
    expect(wrapper.classes()).toContain("container-border");
  });

  it("becomes scrollable automatically when height is set", () => {
    const wrapper = mount(Container, {
      props: { height: 200 },
      slots: { default: "x" },
    });
    expect(wrapper.classes()).toContain("container-scrollable");
    const style = wrapper.attributes("style") ?? "";
    expect(style).toContain("height: 200px");
  });

  it("accepts string heights as-is", () => {
    const wrapper = mount(Container, {
      props: { height: "50vh" },
      slots: { default: "x" },
    });
    const style = wrapper.attributes("style") ?? "";
    expect(style).toContain("height: 50vh");
  });

  it.each([
    ["small", "var(--space-2)"],
    ["medium", "var(--space-4)"],
    ["large", "var(--space-6)"],
    ["none", "0"],
  ] as const)("maps %s gap token to %s", (gap, expected) => {
    const wrapper = mount(Container, {
      props: { gap },
      slots: { default: "x" },
    });
    expect(wrapper.attributes("style")).toContain(`gap: ${expected}`);
  });

  it("passes through custom gap strings", () => {
    const wrapper = mount(Container, {
      props: { gap: "1.5rem" },
      slots: { default: "x" },
    });
    expect(wrapper.attributes("style")).toContain("gap: 1.5rem");
  });
});
