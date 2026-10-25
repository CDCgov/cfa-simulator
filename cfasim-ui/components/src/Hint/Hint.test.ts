import { describe, it, expect, vi } from "vitest";
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
    expect(button.attributes("text")).toBeUndefined();
  });

  it("renders the help icon inside the trigger", () => {
    const wrapper = mount(Hint, {
      props: { text: "Some hint text" },
    });

    expect(wrapper.find(".HintTrigger svg").exists()).toBe(true);
  });

  it("wires the tooltip onto the same trigger once loaded", async () => {
    const wrapper = mount(Hint, {
      props: { text: "Some hint text" },
    });
    expect(
      wrapper.find(".HintTrigger").attributes("data-state"),
    ).toBeUndefined();

    // The implementation chunk resolves through vitest's transform, so give
    // it real time rather than a microtask flush.
    await vi.waitFor(() =>
      expect(wrapper.find(".HintTrigger").attributes("data-state")).toBe(
        "closed",
      ),
    );

    const button = wrapper.find(".HintTrigger");
    expect(button.attributes("aria-label")).toBe("More info");
    expect(button.find("svg").exists()).toBe(true);
  });

  it("renders later instances with the tooltip wired synchronously", async () => {
    const first = mount(Hint, { props: { text: "first" } });
    await vi.waitFor(() =>
      expect(first.find(".HintTrigger").attributes("data-state")).toBe(
        "closed",
      ),
    );

    const second = mount(Hint, { props: { text: "second" } });
    expect(second.find(".HintTrigger").attributes("data-state")).toBe("closed");
  });

  it("does not show tooltip content by default", async () => {
    const wrapper = mount(Hint, {
      props: { text: "Hidden until hover" },
    });
    await vi.waitFor(() =>
      expect(wrapper.find(".HintTrigger").attributes("data-state")).toBe(
        "closed",
      ),
    );

    expect(wrapper.text()).not.toContain("Hidden until hover");
    expect(document.body.textContent).not.toContain("Hidden until hover");
  });
});
