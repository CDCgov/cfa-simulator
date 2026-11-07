import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import LightDarkToggle from "./LightDarkToggle.vue";
import Icon from "../Icon/Icon.vue";

function mockMatchMedia(dark: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: dark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe("LightDarkToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    mockMatchMedia(false);
  });

  it("defaults to auto mode when nothing is stored", () => {
    const wrapper = mount(LightDarkToggle);
    const btn = wrapper.find("button.light-dark-toggle");
    expect(btn.attributes("aria-label")).toBe("Switch to dark mode");
    expect(btn.attributes("title")).toBe("Switch to dark mode");
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBeNull();
  });

  it("when system is light, cycles auto -> dark -> light -> auto and persists to localStorage", async () => {
    mockMatchMedia(false);
    const wrapper = mount(LightDarkToggle);
    const btn = wrapper.find("button.light-dark-toggle");

    // Click 1: auto -> dark (opposite of system light)
    await btn.trigger("click");
    expect(btn.attributes("aria-label")).toBe("Switch to light mode");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBe("dark");

    // Click 2: dark -> light
    await btn.trigger("click");
    expect(btn.attributes("aria-label")).toBe("Switch to auto mode");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBe("light");

    // Click 3: light -> auto
    await btn.trigger("click");
    expect(btn.attributes("aria-label")).toBe("Switch to dark mode");
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBeNull();
  });

  it("when system is dark, cycles auto -> light -> dark -> auto and persists to localStorage", async () => {
    mockMatchMedia(true);
    const wrapper = mount(LightDarkToggle);
    const btn = wrapper.find("button.light-dark-toggle");
    expect(btn.attributes("aria-label")).toBe("Switch to light mode");

    // Click 1: auto -> light (opposite of system dark)
    await btn.trigger("click");
    expect(btn.attributes("aria-label")).toBe("Switch to dark mode");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBe("light");

    // Click 2: light -> dark
    await btn.trigger("click");
    expect(btn.attributes("aria-label")).toBe("Switch to auto mode");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBe("dark");

    // Click 3: dark -> auto
    await btn.trigger("click");
    expect(btn.attributes("aria-label")).toBe("Switch to light mode");
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBeNull();
  });

  it("restores saved light or dark mode from localStorage on mount", () => {
    localStorage.setItem("color-scheme", "dark");
    const wrapper = mount(LightDarkToggle);
    const btn = wrapper.find("button.light-dark-toggle");
    expect(btn.attributes("aria-label")).toBe("Switch to light mode");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("falls back to auto when localStorage contains an unrecognized value", () => {
    localStorage.setItem("color-scheme", "invalid");
    const wrapper = mount(LightDarkToggle);
    const btn = wrapper.find("button.light-dark-toggle");
    expect(btn.attributes("aria-label")).toBe("Switch to dark mode");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("updates target mode when prefers-color-scheme changes in auto mode", async () => {
    let listener: ((e: MediaQueryListEvent) => void) | undefined;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn((_, cb) => {
        listener = cb;
      }),
      removeEventListener: vi.fn(),
    });

    const wrapper = mount(LightDarkToggle);
    const btn = wrapper.find("button.light-dark-toggle");
    expect(btn.attributes("aria-label")).toBe("Switch to dark mode");

    listener?.({ matches: true } as MediaQueryListEvent);
    await wrapper.vm.$nextTick();
    expect(btn.attributes("aria-label")).toBe("Switch to light mode");

    wrapper.unmount();
  });

  it("shows the resolved scheme in auto mode with the auto icon for hover", async () => {
    mockMatchMedia(true);
    const wrapper = mount(LightDarkToggle);
    const icons = () =>
      wrapper.findAllComponents(Icon).map((icon) => ({
        name: icon.props("icon"),
        className: icon.classes().join(" "),
      }));
    expect(icons()).toEqual([
      { name: "dark_mode", className: "Icon resolved-icon" },
      { name: "contrast", className: "Icon auto-icon" },
    ]);

    await wrapper.find("button").trigger("click");
    expect(icons()).toEqual([{ name: "light_mode", className: "Icon" }]);
  });
});
