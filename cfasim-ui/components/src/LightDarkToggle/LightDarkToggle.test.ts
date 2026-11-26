import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import LightDarkToggle from "./LightDarkToggle.vue";

function mockMatchMedia(dark: boolean) {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;
  window.matchMedia = vi.fn().mockReturnValue({
    matches: dark,
    addEventListener: vi.fn((_, callback) => {
      listener = callback;
    }),
    removeEventListener: vi.fn(),
  });
  return (nextDark: boolean) =>
    listener?.({ matches: nextDark } as MediaQueryListEvent);
}

describe("LightDarkToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    mockMatchMedia(false);
  });

  it("cycles auto -> opposite -> same -> auto and syncs classList and localStorage", async () => {
    const wrapper = mount(LightDarkToggle);
    const button = wrapper.find("button.light-dark-toggle");
    expect(localStorage.getItem("color-scheme")).toBeNull();

    await button.trigger("click");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("color-scheme")).toBe("dark");

    await button.trigger("click");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem("color-scheme")).toBe("light");

    await button.trigger("click");
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBeNull();
  });

  it("restores valid saved mode and ignores invalid localStorage values", () => {
    localStorage.setItem("color-scheme", "dark");
    mount(LightDarkToggle);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    document.documentElement.classList.remove("dark");
    localStorage.setItem("color-scheme", "invalid");
    mount(LightDarkToggle);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("reacts to prefers-color-scheme changes in auto mode", async () => {
    const setSystemDark = mockMatchMedia(false);
    const wrapper = mount(LightDarkToggle);
    const button = wrapper.find("button.light-dark-toggle");
    expect(button.attributes("aria-label")).toBe("Switch to dark mode");

    setSystemDark(true);
    await wrapper.vm.$nextTick();
    expect(button.attributes("aria-label")).toBe("Switch to light mode");
    wrapper.unmount();
  });
});
