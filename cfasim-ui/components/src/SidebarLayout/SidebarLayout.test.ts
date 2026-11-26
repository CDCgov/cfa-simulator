import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import SidebarLayout from "./SidebarLayout.vue";

beforeEach(() => {
  // SidebarLayout uses window.matchMedia
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

describe("SidebarLayout tabs", () => {
  it("renders without tabs by default", () => {
    const wrapper = mount(SidebarLayout);
    expect(wrapper.find("[role='tablist']").exists()).toBe(false);
  });

  it("activates tab matching v-model:tab", () => {
    const wrapper = mount(SidebarLayout, {
      props: { tabs, tab: "data" },
    });
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers[1].attributes("data-state")).toBe("active");
  });

  it("emits update:tab when a tab is clicked", async () => {
    let updated: string | undefined;
    const wrapper = mount(SidebarLayout, {
      props: {
        tabs,
        tab: "chart",
        "onUpdate:tab": (v: string | undefined) => {
          updated = v;
        },
      },
    });
    const triggers = wrapper.findAll("[role='tab']");
    // reka-ui triggers need mousedown for activation in happy-dom
    await triggers[2].trigger("mousedown");
    await triggers[2].trigger("focus");
    await triggers[2].trigger("mouseup");
    await triggers[2].trigger("click");
    expect(updated).toBe("table");
  });

  it("shows the current route's tab on the first render", () => {
    const routedTabs = tabs.map((tab) => ({ ...tab, to: `/${tab.value}` }));
    const wrapper = mount(SidebarLayout, {
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
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers[1].attributes("data-state")).toBe("active");
  });

  it("renders default slot content inside tabbed layout", () => {
    const wrapper = mount(SidebarLayout, {
      props: { tabs },
      slots: { default: '<p class="test-content">Hello</p>' },
    });
    expect(wrapper.find(".test-content").text()).toBe("Hello");
  });

  it("renders sidebar slot alongside tabs", () => {
    const wrapper = mount(SidebarLayout, {
      props: { tabs },
      slots: { sidebar: '<div class="sidebar-content">Sidebar</div>' },
    });
    expect(wrapper.find(".sidebar-content").text()).toBe("Sidebar");
    expect(wrapper.findAll("[role='tab']")).toHaveLength(3);
  });
});

describe("SidebarLayout header slots", () => {
  const slots = {
    "sidebar-header-start": '<h2 class="title">Parameters</h2>',
    "sidebar-header-end": '<button class="reset">Reset</button>',
    "topbar-start": '<span class="start">Start</span>',
    "topbar-end": '<button class="export">Export</button>',
  };

  it("renders nothing for the header slots when they are not given", () => {
    const wrapper = mount(SidebarLayout, { props: { tabs } });
    expect(wrapper.find(".SidebarHeaderStart").exists()).toBe(false);
    expect(wrapper.find(".SidebarHeaderEnd").exists()).toBe(false);
    expect(wrapper.find(".SidebarHeader").classes()).toContain(
      "SidebarHeader--bare",
    );
    expect(wrapper.find(".TopbarStart").exists()).toBe(false);
  });

  it("drops the empty end of the tabs bar when the topbar is hidden", () => {
    const wrapper = mount(SidebarLayout, {
      props: { tabs, hideTopbar: true },
    });
    expect(wrapper.find(".TabsBarEnd").exists()).toBe(false);
  });

  it("lays the sidebar header out as start, end, collapse button", () => {
    const wrapper = mount(SidebarLayout, { slots });
    const header = wrapper.find(".SidebarHeader");
    const order = Array.from(header.element.children).map(
      (el) => el.className.split(" ")[0],
    );
    expect(order).toEqual(["SidebarHeaderStart", "SidebarHeaderEnd", "Toggle"]);
    expect(header.classes()).not.toContain("SidebarHeader--bare");
    expect(header.find(".SidebarHeaderStart .title").exists()).toBe(true);
    expect(header.find(".SidebarHeaderEnd .reset").exists()).toBe(true);
  });

  it("still renders the legacy topbar slot at the end", () => {
    const wrapper = mount(SidebarLayout, {
      slots: { topbar: '<button class="legacy">Legacy</button>' },
    });
    expect(wrapper.find(".TopbarEnd .legacy").exists()).toBe(true);
  });

  it("places topbar-start and topbar-end at either end of the plain topbar", () => {
    const wrapper = mount(SidebarLayout, { slots });
    const bar = wrapper.find(".Topbar");
    expect(bar.find(".TopbarStart .start").exists()).toBe(true);
    expect(bar.find(".TopbarEnd .export").exists()).toBe(true);
    expect(wrapper.find(".TabsBar").exists()).toBe(false);
  });

  it("places topbar-start before the tabs and topbar-end after them", () => {
    const wrapper = mount(SidebarLayout, { props: { tabs }, slots });
    const bar = wrapper.find(".TabsBar");
    const order = Array.from(bar.element.children).map((el) => el.className);
    expect(order.indexOf("TopbarStart")).toBeLessThan(
      order.findIndex((c) => c.includes("BarTabs")),
    );
    expect(bar.find(".TopbarStart .start").exists()).toBe(true);
    expect(bar.find(".TabsBarEnd .export").exists()).toBe(true);
  });
});

describe("SidebarLayout collapse accessibility", () => {
  it("keeps the sidebar interactive and hides the expand button when expanded", () => {
    const wrapper = mount(SidebarLayout);
    // Starts expanded on desktop (matchMedia matches=false).
    expect(wrapper.find(".Sidebar").attributes("inert")).toBeUndefined();
    expect(wrapper.find(".Toggle--expand").attributes("inert")).toBe("");
  });

  it("makes the hidden sidebar inert and the expand button interactive when collapsed", async () => {
    const wrapper = mount(SidebarLayout);
    await wrapper.find(".SidebarHeader .Toggle").trigger("click");
    // Collapsed: sidebar is visually hidden, expand button is shown.
    expect(wrapper.find(".Sidebar").attributes("inert")).toBe("");
    expect(wrapper.find(".Toggle--expand").attributes("inert")).toBeUndefined();
  });
});

describe("SidebarLayout right sidebar", () => {
  type ChangeListener = (event: { matches: boolean }) => void;

  // Answers the layout's width queries for a viewport of this width, and no
  // to anything else (LightDarkToggle asks for the color scheme). Returns a
  // function that resizes the viewport and notifies the queries that changed.
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

    return async function resize(newWidth: number) {
      for (const update of updates) update(newWidth);
      await nextTick();
    };
  }

  function openSidebars(wrapper: VueWrapper) {
    return {
      left: wrapper.attributes("data-collapsed") === "false",
      right: wrapper.attributes("data-right-collapsed") === "false",
    };
  }

  const slots = {
    "sidebar-right": '<div class="right-content">Summary</div>',
    "sidebar-right-header-start": '<h2 class="title">Summary</h2>',
    "sidebar-right-header-end": '<button class="clear">Clear</button>',
  };
  const leftSidebar = ".SidebarRail:not(.SidebarRail--right) .Sidebar";
  const rightSidebar = ".SidebarRail--right .Sidebar";

  it("renders no right rail without the sidebar-right slot", () => {
    const wrapper = mount(SidebarLayout);
    expect(wrapper.find(".SidebarRail--right").exists()).toBe(false);
    expect(wrapper.attributes("data-right-collapsed")).toBeUndefined();
    expect(wrapper.find("aside").attributes("aria-label")).toBeUndefined();
  });

  it("lays the right header out as collapse button, start, end", () => {
    const wrapper = mount(SidebarLayout, { slots });
    const rail = wrapper.find(".SidebarRail--right");
    const header = rail.find(".SidebarHeader");
    const order = Array.from(header.element.children).map(
      (el) => el.className.split(" ")[0],
    );
    expect(order).toEqual(["Toggle", "SidebarHeaderStart", "SidebarHeaderEnd"]);
    expect(header.classes()).not.toContain("SidebarHeader--bare");
    expect(wrapper.find(".SidebarHeader").classes()).toContain(
      "SidebarHeader--bare",
    );
    expect(header.find(".SidebarHeaderStart .title").exists()).toBe(true);
    expect(header.find(".SidebarHeaderEnd .clear").exists()).toBe(true);
    expect(rail.find(".right-content").text()).toBe("Summary");
    expect(rail.find("aside").attributes("aria-label")).toBe("Right sidebar");
    expect(wrapper.find(leftSidebar).attributes("aria-label")).toBe(
      "Left sidebar",
    );
  });

  it("opens both sidebars on a wide window and collapses them separately", async () => {
    mockViewportWidth(1440);
    const wrapper = mount(SidebarLayout, { slots });
    expect(wrapper.find(leftSidebar).attributes("inert")).toBeUndefined();
    expect(wrapper.find(rightSidebar).attributes("inert")).toBeUndefined();

    await wrapper
      .find(".SidebarRail--right .SidebarHeader .Toggle")
      .trigger("click");
    expect(wrapper.find(rightSidebar).attributes("inert")).toBe("");
    expect(wrapper.find(leftSidebar).attributes("inert")).toBeUndefined();

    await wrapper.find(".SidebarRail--right .Toggle--expand").trigger("click");
    expect(wrapper.find(rightSidebar).attributes("inert")).toBeUndefined();
    expect(wrapper.find(leftSidebar).attributes("inert")).toBeUndefined();
  });

  it("keeps one sidebar open at a time on a narrower window", async () => {
    mockViewportWidth(1000);
    const wrapper = mount(SidebarLayout, { slots });
    expect(wrapper.find(leftSidebar).attributes("inert")).toBeUndefined();
    expect(wrapper.find(rightSidebar).attributes("inert")).toBe("");

    await wrapper.find(".SidebarRail--right .Toggle--expand").trigger("click");
    expect(wrapper.find(rightSidebar).attributes("inert")).toBeUndefined();
    expect(wrapper.find(leftSidebar).attributes("inert")).toBe("");

    await wrapper.find(".SidebarRail .Toggle--expand").trigger("click");
    expect(wrapper.find(leftSidebar).attributes("inert")).toBeUndefined();
    expect(wrapper.find(rightSidebar).attributes("inert")).toBe("");
  });

  it("closes the right sidebar for a narrower window and reopens it after", async () => {
    const resize = mockViewportWidth(1440);
    const wrapper = mount(SidebarLayout, { slots });
    await resize(1000);
    expect(openSidebars(wrapper)).toEqual({ left: true, right: false });
    await resize(1440);
    expect(openSidebars(wrapper)).toEqual({ left: true, right: true });
  });

  it("leaves the right sidebar as the user set it across a resize", async () => {
    const resize = mockViewportWidth(1440);
    const wrapper = mount(SidebarLayout, { slots });
    // Open alone, it fits the narrower window.
    await wrapper.find(".SidebarHeader .Toggle").trigger("click");
    await resize(1000);
    expect(openSidebars(wrapper)).toEqual({ left: false, right: true });
    // Collapsed by hand, it stays collapsed when the room comes back.
    await wrapper
      .find(".SidebarRail--right .SidebarHeader .Toggle")
      .trigger("click");
    await resize(1440);
    expect(openSidebars(wrapper)).toEqual({ left: false, right: false });
  });

  it("makes room for the left sidebar when a phone with the right one open widens", async () => {
    const resize = mockViewportWidth(430);
    const wrapper = mount(SidebarLayout, { slots });
    await wrapper.find(".Toggle--end").trigger("click");
    expect(openSidebars(wrapper)).toEqual({ left: false, right: true });
    await resize(800);
    expect(openSidebars(wrapper)).toEqual({ left: true, right: false });
    await resize(1440);
    expect(openSidebars(wrapper)).toEqual({ left: true, right: true });
  });

  it.each([
    { bar: ".Topbar", barTabs: undefined },
    { bar: ".TabsBar", barTabs: tabs },
  ])("opens from the far end of $bar on a phone", async ({ bar, barTabs }) => {
    mockViewportWidth(375);
    const wrapper = mount(SidebarLayout, { props: { tabs: barTabs }, slots });
    expect(wrapper.attributes("data-right-collapsed")).toBe("true");
    const children = wrapper.find(bar).element.children;
    expect(children[children.length - 1].className).toContain("Toggle--end");

    await wrapper.find(`${bar} .Toggle--end`).trigger("click");
    expect(wrapper.attributes("data-right-collapsed")).toBe("false");
    expect(wrapper.find(`${bar} .Toggle--end`).exists()).toBe(false);
  });
});

describe("SidebarLayout maxWidth", () => {
  it("leaves the default width to CSS when unset", () => {
    const wrapper = mount(SidebarLayout);
    expect(wrapper.find(".MainContent").attributes("style")).toBeUndefined();
  });

  it("sets the content max width from a number or CSS length", async () => {
    const wrapper = mount(SidebarLayout, { props: { maxWidth: 1400 } });
    const style = () =>
      (wrapper.find(".MainContent").element as HTMLElement).style;
    expect(style().getPropertyValue("--main-content-max-width")).toBe("1400px");
    await wrapper.setProps({ maxWidth: "none" });
    expect(style().getPropertyValue("--main-content-max-width")).toBe("none");
  });

  it("applies to the tabbed layout", () => {
    const wrapper = mount(SidebarLayout, {
      props: { tabs, maxWidth: "80rem" },
    });
    const el = wrapper.find(".MainContent").element as HTMLElement;
    expect(el.style.getPropertyValue("--main-content-max-width")).toBe("80rem");
  });
});
