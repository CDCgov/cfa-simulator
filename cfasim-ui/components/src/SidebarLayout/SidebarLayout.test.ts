import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
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

  it("renders tab triggers when tabs prop is provided", () => {
    const wrapper = mount(SidebarLayout, { props: { tabs } });
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers).toHaveLength(3);
    expect(triggers[0].text()).toBe("Chart");
    expect(triggers[1].text()).toBe("Data");
    expect(triggers[2].text()).toBe("Table");
  });

  it("defaults to first tab as active", () => {
    const wrapper = mount(SidebarLayout, { props: { tabs } });
    const triggers = wrapper.findAll("[role='tab']");
    expect(triggers[0].attributes("data-state")).toBe("active");
    expect(triggers[1].attributes("data-state")).toBe("inactive");
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
