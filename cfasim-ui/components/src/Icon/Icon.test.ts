import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Icon from "./Icon.vue";

describe("Icon", () => {
  it("renders an inline svg for a registered icon", () => {
    const wrapper = mount(Icon, { props: { icon: "help" } });
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.find(".Icon").exists()).toBe(true);
  });

  it("applies size presets and numeric sizes", () => {
    const preset = mount(Icon, { props: { icon: "help", size: "lg" } });
    expect(preset.find(".Icon").attributes("data-size")).toBe("lg");

    const numeric = mount(Icon, { props: { icon: "help", size: 40 } });
    expect(numeric.find(".Icon").attributes("style")).toContain("width: 40px");
  });

  it("renders the fill variant without warning when one is registered", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(Icon, { props: { icon: "favorite", fill: true } });
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns once and renders nothing for an unregistered icon", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(Icon, { props: { icon: "totally_made_up_icon" } });
    expect(wrapper.find("svg").exists()).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("totally_made_up_icon");
    expect(warn.mock.calls[0][0]).toContain("registerIcons");

    // Deduped across instances.
    mount(Icon, { props: { icon: "totally_made_up_icon" } });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("is decorative (aria-hidden) by default", () => {
    const wrapper = mount(Icon, { props: { icon: "help" } });
    expect(wrapper.find(".Icon").attributes("aria-hidden")).toBe("true");
  });

  it("exposes a label and img role when not decorative", () => {
    const wrapper = mount(Icon, {
      props: { icon: "help", decorative: false, ariaLabel: "Help" },
    });
    const span = wrapper.find(".Icon");
    expect(span.attributes("aria-hidden")).toBeUndefined();
    expect(span.attributes("role")).toBe("img");
    expect(span.attributes("aria-label")).toBe("Help");
  });
});
