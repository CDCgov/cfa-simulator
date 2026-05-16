import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ParamEditor from "./ParamEditor.vue";

describe("ParamEditor", () => {
  it("mounts without throwing and defers the editor to a dynamic import", () => {
    const wrapper = mount(ParamEditor, {
      props: { value: { a: 1 } },
    });
    // The wrapper renders synchronously; the heavy editor implementation
    // is fetched via `defineAsyncComponent` and is not present in the
    // initial DOM. We don't assert on the Spinner because Vue may delay
    // rendering it past the `delay` threshold.
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find(".cm-editor").exists()).toBe(false);
  });
});
