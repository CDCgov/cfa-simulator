import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { truncateLabel, useChartFontFamily } from "./xAxis.js";

describe("truncateLabel", () => {
  const measure = (s: string) => s.length * 6;
  it("keeps labels that fit and shortens wider ones with an ellipsis", () => {
    expect(truncateLabel("Arizona", 50, measure)).toBe("Arizona");
    expect(truncateLabel("North Carolina", 36, measure)).toBe("North…");
    expect(truncateLabel("North Carolina", 4, measure)).toBe("…");
  });
});

describe("useChartFontFamily", () => {
  const original = Object.getOwnPropertyDescriptor(document, "fonts");
  afterEach(() => {
    if (original) Object.defineProperty(document, "fonts", original);
    else delete (document as { fonts?: unknown }).fonts;
  });

  it("reruns measurements when a web font finishes loading", async () => {
    const fonts = new EventTarget();
    const removeListener = vi.spyOn(fonts, "removeEventListener");
    Object.defineProperty(document, "fonts", {
      value: fonts,
      configurable: true,
    });
    let measured = 0;
    const wrapper = mount(
      defineComponent({
        setup() {
          const family = useChartFontFamily(() => null);
          const width = computed(() => {
            measured++;
            return family.value.length;
          });
          return () => h("span", width.value);
        },
      }),
    );
    await nextTick();
    const afterMount = measured;

    // The family string is unchanged, the measurement still has to rerun.
    fonts.dispatchEvent(new Event("loadingdone"));
    await nextTick();
    expect(measured).toBe(afterMount + 1);

    wrapper.unmount();
    expect(removeListener).toHaveBeenCalledWith(
      "loadingdone",
      expect.any(Function),
    );
  });
});
