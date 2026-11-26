import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import SidebarLayout from "./SidebarLayout.vue";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

const tabs = [
  { value: "chart", label: "Chart" },
  { value: "data", label: "Data" },
  { value: "table", label: "Table" },
];

type ChangeListener = (event: { matches: boolean }) => void;

function mockViewportWidth(width: number) {
  const updates: ((newWidth: number) => void)[] = [];
  window.matchMedia = vi.fn((query: string) => {
    const listeners = new Set<ChangeListener>();
    const list = {
      matches: false,
      addEventListener: (_type: string, listener: ChangeListener) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: ChangeListener) =>
        listeners.delete(listener),
    };
    const widthQuery = query.match(/\((min|max)-width: (\d+)px\)/);
    if (widthQuery) {
      const pixels = Number(widthQuery[2]);
      const matchesAt = (candidate: number) =>
        widthQuery[1] === "min" ? candidate >= pixels : candidate <= pixels;
      list.matches = matchesAt(width);
      updates.push((newWidth) => {
        const matches = matchesAt(newWidth);
        if (matches === list.matches) return;
        list.matches = matches;
        for (const listener of listeners) listener({ matches });
      });
    }
    return list;
  }) as never;

  return async (newWidth: number) => {
    for (const update of updates) update(newWidth);
    await nextTick();
  };
}

const openSidebars = (wrapper: VueWrapper) => ({
  left: wrapper.attributes("data-collapsed") === "false",
  right: wrapper.attributes("data-right-collapsed") === "false",
});

describe("SidebarLayout", () => {
  it("wires v-model:tab clicks and activates the current route tab", async () => {
    let updated: string | undefined;
    const wrapper = mount(SidebarLayout, {
      props: {
        tabs,
        tab: "chart",
        "onUpdate:tab": (value: string | undefined) => {
          updated = value;
        },
      },
    });
    const target = wrapper.findAll("[role='tab']")[2];
    await target.trigger("mousedown");
    await target.trigger("focus");
    await target.trigger("mouseup");
    await target.trigger("click");
    expect(updated).toBe("table");

    const routedTabs = tabs.map((tab) => ({ ...tab, to: `/${tab.value}` }));
    const routed = mount(SidebarLayout, {
      props: { tabs: routedTabs },
      global: {
        config: {
          globalProperties: {
            $router: { push: () => {} },
            $route: { path: "/data" },
          } as never,
        },
      },
    });
    expect(routed.findAll("[role='tab']")[1].attributes("data-state")).toBe(
      "active",
    );
  });

  it("toggles inert between the sidebar and expand button on collapse", async () => {
    const wrapper = mount(SidebarLayout);
    expect(wrapper.find(".Sidebar").attributes("inert")).toBeUndefined();
    expect(wrapper.find(".Toggle--expand").attributes("inert")).toBe("");
    await wrapper.find(".SidebarHeader .Toggle").trigger("click");
    expect(wrapper.find(".Sidebar").attributes("inert")).toBe("");
    expect(wrapper.find(".Toggle--expand").attributes("inert")).toBeUndefined();
  });

  it("manages dual-rail rightWanted state across narrow, wide, and phone viewports", async () => {
    const slots = {
      "sidebar-right": '<div class="right-content">Summary</div>',
    };
    const resize = mockViewportWidth(1440);
    const wrapper = mount(SidebarLayout, { slots });
    expect(openSidebars(wrapper)).toEqual({ left: true, right: true });

    await resize(1000);
    expect(openSidebars(wrapper)).toEqual({ left: true, right: false });

    await wrapper.find(".SidebarRail--right .Toggle--expand").trigger("click");
    expect(openSidebars(wrapper)).toEqual({ left: false, right: true });

    await wrapper
      .find(".SidebarRail--right .SidebarHeader .Toggle")
      .trigger("click");
    await resize(1440);
    expect(openSidebars(wrapper)).toEqual({ left: false, right: false });

    const phoneResize = mockViewportWidth(430);
    const phone = mount(SidebarLayout, { props: { tabs }, slots });
    await phone.find(".TabsBar .Toggle--end").trigger("click");
    expect(openSidebars(phone)).toEqual({ left: false, right: true });
    await phoneResize(800);
    expect(openSidebars(phone)).toEqual({ left: true, right: false });
    await phoneResize(1440);
    expect(openSidebars(phone)).toEqual({ left: true, right: true });
  });
});
