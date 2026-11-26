import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Tabs from "./Tabs.vue";

const tabs = [
  { value: "chart", label: "Chart", to: "/chart" },
  { value: "data", label: "Data", to: "/data" },
  { value: "table", label: "Table", to: "/table" },
];

async function click(trigger: ReturnType<ReturnType<typeof mount>["find"]>) {
  await trigger.trigger("mousedown");
  await trigger.trigger("focus");
  await trigger.trigger("mouseup");
  await trigger.trigger("click");
}

describe("Tabs", () => {
  it("activates the v-model tab and emits updates on click", async () => {
    const wrapper = mount(Tabs, { props: { tabs, modelValue: "data" } });
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers[1].attributes("data-state")).toBe("active");
    await click(triggers[2]);
    expect(wrapper.emitted("update:modelValue")).toEqual([["table"]]);
  });

  it("tracks the active route and pushes on click in router mode", async () => {
    const pushed: string[] = [];
    const wrapper = mount(Tabs, {
      props: { tabs },
      global: {
        config: {
          globalProperties: {
            $router: { push: (to: string) => pushed.push(to) },
            $route: { path: "/data" },
          } as never,
        },
      },
    });
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers[1].attributes("data-state")).toBe("active");
    await click(triggers[2]);
    expect(pushed).toEqual(["/table"]);
  });
});
