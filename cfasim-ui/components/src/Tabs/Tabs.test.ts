import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Tabs from "./Tabs.vue";

const tabs = [
  { value: "chart", label: "Chart", to: "/chart" },
  { value: "data", label: "Data", to: "/data" },
  { value: "table", label: "Table", to: "/table" },
];

async function click(trigger: ReturnType<ReturnType<typeof mount>["find"]>) {
  // reka-ui triggers need mousedown for activation in happy-dom
  await trigger.trigger("mousedown");
  await trigger.trigger("focus");
  await trigger.trigger("mouseup");
  await trigger.trigger("click");
}

describe("Tabs", () => {
  it("renders a labelled tab list with a trigger per tab", () => {
    const wrapper = mount(Tabs, { props: { tabs, label: "Views" } });
    expect(wrapper.find("[role='tablist']").attributes("aria-label")).toBe(
      "Views",
    );
    const labels = wrapper.findAll("[role='tab']").map((tab) => tab.text());
    expect(labels).toEqual(["Chart", "Data", "Table"]);
  });

  it("defaults to the first tab", () => {
    const wrapper = mount(Tabs, { props: { tabs } });
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers[0].attributes("data-state")).toBe("active");
    expect(triggers[1].attributes("data-state")).toBe("inactive");
  });

  it("activates the tab matching v-model", () => {
    const wrapper = mount(Tabs, { props: { tabs, modelValue: "data" } });
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers[1].attributes("data-state")).toBe("active");
  });

  it("emits update:modelValue when a tab is clicked", async () => {
    const wrapper = mount(Tabs, { props: { tabs, modelValue: "chart" } });
    await click(wrapper.findAll("[role='tab']")[2]);
    expect(wrapper.emitted("update:modelValue")).toEqual([["table"]]);
  });

  describe("router mode", () => {
    function mountWithRouter(path: string) {
      const pushed: string[] = [];
      const wrapper = mount(Tabs, {
        props: { tabs },
        global: {
          config: {
            globalProperties: {
              $router: { push: (to: string) => pushed.push(to) },
              $route: { path },
            } as never,
          },
        },
      });
      return { wrapper, pushed };
    }

    it("activates the tab whose route is current", () => {
      const { wrapper } = mountWithRouter("/data");
      const triggers = wrapper.findAll("[role='tab']");
      expect(triggers[1].attributes("data-state")).toBe("active");
    });

    it("navigates to the tab's route on click", async () => {
      const { wrapper, pushed } = mountWithRouter("/chart");
      await click(wrapper.findAll("[role='tab']")[2]);
      expect(pushed).toEqual(["/table"]);
    });
  });
});
