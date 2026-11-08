import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TextArea from "./TextArea.vue";

function mountControlled(extra: Record<string, unknown> = {}) {
  const wrapper = mount(TextArea, {
    props: {
      modelValue: "initial",
      label: "Notes",
      "onUpdate:modelValue": (v: string | undefined) =>
        wrapper.setProps({ modelValue: v }),
      ...extra,
    },
  });
  return wrapper;
}

describe("TextArea", () => {
  it("labels the textarea with <label for>", () => {
    const wrapper = mount(TextArea, {
      props: { modelValue: "", label: "Notes" },
    });
    const label = wrapper.find("label");
    const textarea = wrapper.find("textarea");
    expect(label.text()).toContain("Notes");
    expect(label.attributes("for")).toBe(textarea.attributes("id"));
    expect(textarea.attributes("rows")).toBe("3");
  });

  it("commits on blur and on Ctrl/Cmd+Enter, not on typing", async () => {
    const wrapper = mountControlled();
    const textarea = wrapper.find("textarea");
    await textarea.setValue("line one\nline two");
    expect(wrapper.props("modelValue")).toBe("initial");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.props("modelValue")).toBe("initial");
    await textarea.trigger("keydown", { key: "Enter", metaKey: true });
    expect(wrapper.props("modelValue")).toBe("line one\nline two");

    await textarea.setValue("blurred");
    await textarea.trigger("blur");
    expect(wrapper.props("modelValue")).toBe("blurred");
  });

  it("applies rows, resize, maxLength and autoGrow", () => {
    const wrapper = mount(TextArea, {
      props: {
        modelValue: "",
        ariaLabel: "Notes",
        rows: 6,
        resize: "none",
        maxLength: 200,
        autoGrow: true,
      },
    });
    const textarea = wrapper.find("textarea");
    expect(textarea.attributes("rows")).toBe("6");
    expect(textarea.attributes("maxlength")).toBe("200");
    expect(textarea.attributes("aria-label")).toBe("Notes");
    expect((textarea.element as HTMLTextAreaElement).style.resize).toBe("none");
    expect(textarea.classes()).toContain("text-area-auto-grow");
  });

  it("syncs an external model change into the field", async () => {
    const wrapper = mount(TextArea, {
      props: { modelValue: "original", label: "Notes" },
    });
    await wrapper.setProps({ modelValue: "reset" });
    expect(
      (wrapper.find("textarea").element as HTMLTextAreaElement).value,
    ).toBe("reset");
  });
});
