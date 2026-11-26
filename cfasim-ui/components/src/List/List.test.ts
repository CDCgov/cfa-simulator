import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import List from "./List.vue";
import Menu from "../Menu/Menu.vue";
import type { ListOption } from "./List.vue";

const items: ListOption[] = [
  { value: "a", label: "Alpha", swatch: "#c00" },
  { value: "b", label: "Beta", icon: "edit", description: "Second" },
  { value: "c", label: "Gamma", disabled: true },
];

afterEach(() => vi.restoreAllMocks());

describe("List", () => {
  it("toggles collapse only when collapsible", async () => {
    const fixed = mount(List, {
      props: { items, label: "Scenarios", open: false },
    });
    expect(fixed.findAll("li")).toHaveLength(3);

    const wrapper = mount(List, {
      props: {
        items,
        label: "Scenarios",
        collapsible: true,
        "onUpdate:open": (value: boolean) => wrapper.setProps({ open: value }),
      },
    });
    const trigger = wrapper.find(".ListHeaderTrigger");
    await trigger.trigger("click");
    expect(wrapper.emitted("update:open")?.[0]).toEqual([false]);
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });

  it("handles selectable mode, row actions, disabled items, and missing-value warning", async () => {
    const wrapper = mount(List, {
      props: {
        items,
        selectable: true,
        selected: "a",
        itemAction: "more_horiz",
        itemActionLabel: "More",
        "onUpdate:selected": (value: string | number | undefined) =>
          wrapper.setProps({ selected: value }),
      },
    });
    const rows = wrapper.findAll("li");
    await rows[1].find(".ListMain").trigger("click");
    expect(wrapper.emitted("update:selected")?.at(-1)).toEqual(["b"]);
    expect(rows[2].find(".ListMain").attributes("disabled")).toBeDefined();

    await rows[1].find(".ListAction").trigger("click");
    expect(wrapper.emitted("select")).toHaveLength(1);
    expect(wrapper.emitted("item-action")?.[0]?.[1]).toBe(1);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unvalued = mount(List, {
      props: { items: [{ label: "No value" }], selectable: true },
    });
    await unvalued.find(".ListMain").trigger("click");
    expect(unvalued.emitted("update:selected")).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("renders href and to as links and routes plain clicks through $router", async () => {
    const push = vi.fn();
    const $router = { push, resolve: (to: string) => ({ href: `#${to}` }) };
    const wrapper = mount(List, {
      props: {
        items: [
          { value: "docs", label: "Docs", href: "https://example.com" },
          { value: "map", label: "Map", to: "/map" },
        ],
      },
      global: { config: { globalProperties: { $router } } },
    });
    const links = wrapper.findAll("a.ListMain");
    expect(links.map((link) => link.attributes("href"))).toEqual([
      "https://example.com",
      "#/map",
    ]);
    await links[1].trigger("click", { button: 0 });
    expect(push).toHaveBeenCalledWith("/map");
    await links[1].trigger("click", { button: 0, metaKey: true });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("wires per-row itemMenu and headerMenu selections", () => {
    const wrapper = mount(List, {
      props: {
        items,
        itemActionLabel: "Actions",
        headerAction: "add",
        headerActionLabel: "Add",
        headerMenu: [{ value: "blank", label: "Blank" }],
        itemMenu: (item: ListOption) =>
          item.value === "c"
            ? []
            : [{ value: "delete", label: `Delete ${item.label}` }],
      },
    });
    const menus = wrapper.findAllComponents(Menu);
    expect(menus).toHaveLength(3);
    menus[0].vm.$emit("select", menus[0].props("items")[0], 0);
    expect(wrapper.emitted("header-menu-select")?.[0]?.[1]).toBe(0);

    menus[2].vm.$emit("select", menus[2].props("items")[0], 0);
    const [option, item, index] = wrapper.emitted("item-menu-select")![0] as [
      { value: string },
      ListOption,
      number,
    ];
    expect([option.value, item.value, index]).toEqual(["delete", "b", 1]);
  });
});
