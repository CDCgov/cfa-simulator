import { nextTick } from "vue";
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SelectBox from "./SelectBox.vue";

const options = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

describe("SelectBox", () => {
  it("distinguishes an empty-string option from an unset placeholder", async () => {
    const withAll = [{ value: "", label: "All" }, ...options];
    const selected = mount(SelectBox, {
      props: { options: withAll, modelValue: "", placeholder: "Pick one" },
    });
    await nextTick();
    expect(selected.find(".select-trigger").text()).toBe("All");

    const unset = mount(SelectBox, {
      props: { options: withAll, placeholder: "Pick one" },
    });
    expect(unset.find(".select-trigger").text()).toBe("Pick one");
  });

  describe("autocomplete", () => {
    it("displays the selected label and clears via button or deleting text", async () => {
      const wrapper = mount(SelectBox, {
        props: {
          options,
          modelValue: "weekly",
          autocomplete: true,
          "onUpdate:modelValue": (value: string | undefined) =>
            wrapper.setProps({ modelValue: value }),
        },
        attachTo: document.body,
      });
      const input = wrapper.find(".select-input");
      expect((input.element as HTMLInputElement).value).toBe("Weekly");

      await wrapper.find(".select-clear").trigger("click");
      expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([""]);
      expect(document.activeElement).toBe(input.element);
      expect(wrapper.find(".select-clear").exists()).toBe(false);

      await wrapper.setProps({ modelValue: "daily" });
      await input.setValue("Dai");
      expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
      await input.setValue("");
      expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([""]);
      wrapper.unmount();
    });

    it("prevents clearing when required", async () => {
      const wrapper = mount(SelectBox, {
        props: {
          options,
          modelValue: "weekly",
          autocomplete: true,
          required: true,
        },
      });
      expect(wrapper.find(".select-clear").exists()).toBe(false);
      await wrapper.find(".select-input").setValue("");
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });
  });
});
