import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { h } from "vue";
import ButtonGroup from "./ButtonGroup.vue";
import Button from "../Button/Button.vue";

describe("ButtonGroup", () => {
  it("renders slotted buttons", () => {
    const wrapper = mount(ButtonGroup, {
      slots: {
        default: () => ["Cut", "Copy", "Paste"].map((l) => h(Button, () => l)),
      },
    });
    const buttons = wrapper.findAll(".button");
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.text())).toEqual(["Cut", "Copy", "Paste"]);
  });

  it("exposes a group role", () => {
    const wrapper = mount(ButtonGroup, {
      props: { ariaLabel: "Text alignment" },
    });
    const group = wrapper.find(".button-group");
    expect(group.attributes("role")).toBe("group");
    expect(group.attributes("aria-label")).toBe("Text alignment");
  });

  it("defaults to horizontal orientation", () => {
    const wrapper = mount(ButtonGroup);
    expect(wrapper.find(".button-group").attributes("data-orientation")).toBe(
      "horizontal",
    );
  });

  it("reflects vertical orientation", () => {
    const wrapper = mount(ButtonGroup, {
      props: { orientation: "vertical" },
    });
    expect(wrapper.find(".button-group").attributes("data-orientation")).toBe(
      "vertical",
    );
  });
});
