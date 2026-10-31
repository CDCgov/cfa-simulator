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
  it("renders items with swatches, icons and descriptions", () => {
    const wrapper = mount(List, { props: { items } });
    const rows = wrapper.findAll("li");
    expect(rows.map((r) => r.find(".OptionLabel").text())).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(rows[0].find(".OptionSwatch").attributes("style")).toContain(
      "background-color",
    );
    expect(rows[1].find(".OptionIcon").exists()).toBe(true);
    expect(rows[1].find(".OptionDescription").text()).toBe("Second");
    expect(rows[2].attributes("data-disabled")).toBe("true");
    expect(wrapper.find("[data-interactive]").exists()).toBe(false);
  });

  it("omits the header without a label, header slot or header action", () => {
    const wrapper = mount(List, { props: { items } });
    expect(wrapper.find(".ListHeader").exists()).toBe(false);
    expect(wrapper.find("ul").attributes("aria-labelledby")).toBeUndefined();
  });

  it("labels the list by its header", () => {
    const wrapper = mount(List, { props: { items, label: "Scenarios" } });
    const id = wrapper.find("ul").attributes("aria-labelledby");
    expect(wrapper.find(`#${id}`).text()).toBe("Scenarios");
    expect(wrapper.find(".ListHeaderTrigger").exists()).toBe(false);
  });

  it("collapses from the header when collapsible", async () => {
    const wrapper = mount(List, {
      props: {
        items,
        label: "Scenarios",
        collapsible: true,
        "onUpdate:open": (v: boolean) => wrapper.setProps({ open: v }),
      },
    });
    const trigger = wrapper.find(".ListHeaderTrigger");
    expect(trigger.attributes("aria-expanded")).toBe("true");
    await trigger.trigger("click");
    expect(wrapper.emitted("update:open")?.[0]).toEqual([false]);
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });

  it("stays open when not collapsible even if open is false", () => {
    const wrapper = mount(List, {
      props: { items, label: "Scenarios", open: false },
    });
    expect(wrapper.findAll("li")).toHaveLength(3);
  });

  it("emits header and item actions", async () => {
    const wrapper = mount(List, {
      props: {
        items,
        label: "Scenarios",
        headerAction: "add",
        headerActionLabel: "Add scenario",
        itemAction: "more_horiz",
        itemActionLabel: "More actions",
      },
    });
    const header = wrapper.find(".ListHeader .ListAction");
    expect(header.attributes("aria-label")).toBe("Add scenario");
    await header.trigger("click");
    expect(wrapper.emitted("header-action")).toHaveLength(1);

    const itemButtons = wrapper.findAll("li .ListAction");
    expect(itemButtons[1].attributes("aria-label")).toBe("More actions: Beta");
    await itemButtons[1].trigger("click");
    const [item, index] = wrapper.emitted("item-action")![0] as [
      ListOption,
      number,
    ];
    expect(item.value).toBe("b");
    expect(index).toBe(1);
    expect(itemButtons[2].attributes("disabled")).toBeDefined();
  });

  it("names unlabeled action buttons by icon and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(List, {
      props: { items, label: "S", headerAction: "add", itemAction: "edit" },
    });
    expect(
      wrapper.find(".ListHeader .ListAction").attributes("aria-label"),
    ).toBe("add");
    expect(wrapper.find("li .ListAction").attributes("aria-label")).toBe(
      "edit: Alpha",
    );
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(
      messages.filter((m) => m.includes("headerActionLabel")),
    ).toHaveLength(1);
    expect(messages.filter((m) => m.includes("itemActionLabel"))).toHaveLength(
      1,
    );
  });

  it("replaces action buttons with the action slots", () => {
    const wrapper = mount(List, {
      props: { items, label: "S", itemAction: "edit" },
      slots: {
        "header-action": "<button class='mine'>new</button>",
        action: `<template #action="{ item }"><button class="row">{{ item.value }}</button></template>`,
      },
    });
    expect(wrapper.find(".ListHeader .ListActions .mine").exists()).toBe(true);
    expect(wrapper.findAll(".ListActions .row").map((b) => b.text())).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(wrapper.find(".ListAction").exists()).toBe(false);
  });

  it("puts swatches and descriptions at the end, and fills the end slot", () => {
    const atEnd = mount(List, {
      props: {
        items: [
          { label: "Scenario A", description: "Baseline", swatch: "#c00" },
        ],
        swatchPosition: "end",
        descriptionPosition: "end",
        itemAction: "more_horiz",
        itemActionLabel: "More",
      },
    });
    const row = [...atEnd.find("li").element.children].map(
      (el) => el.className,
    );
    expect(row.slice(-2)).toEqual(["OptionEnd", "ListActions"]);
    const end = [...atEnd.find(".OptionEnd").element.children].map(
      (el) => el.className,
    );
    expect(end).toEqual([
      "OptionDescription OptionDescriptionEnd",
      "OptionSwatchEnd",
    ]);
    expect(atEnd.findAll(".OptionDescription")).toHaveLength(1);

    const custom = mount(List, {
      props: { items },
      slots: {
        end: `<template #end="{ item }"><kbd>{{ item.value }}</kbd></template>`,
      },
    });
    expect(custom.findAll("kbd").map((k) => k.text())).toEqual(["a", "b", "c"]);
  });

  it("renders custom start, text and header-end slots", () => {
    const wrapper = mount(List, {
      props: { items, label: "S" },
      slots: {
        start: `<template #start="{ index }"><b class="n">{{ index }}</b></template>`,
        text: `<template #text="{ item }"><i>{{ item.label.toUpperCase() }}</i></template>`,
        "header-end": "<span class='count'>3</span>",
      },
    });
    expect(wrapper.findAll(".n").map((n) => n.text())).toEqual(["0", "1", "2"]);
    expect(wrapper.find("li i").text()).toBe("ALPHA");
    expect(wrapper.find(".OptionSwatch").exists()).toBe(false);
    expect(wrapper.find(".ListHeader .OptionEnd .count").text()).toBe("3");
  });

  it("selects options by value", async () => {
    const wrapper = mount(List, {
      props: {
        items,
        selectable: true,
        selected: "a",
        itemAction: "more_horiz",
        itemActionLabel: "More",
        "onUpdate:selected": (v: string | number | undefined) =>
          wrapper.setProps({ selected: v }),
      },
    });
    const rows = wrapper.findAll("li");
    expect(rows[0].attributes("data-selected")).toBe("true");
    expect(rows[0].find(".ListMain").attributes("aria-current")).toBe("true");

    await rows[1].find(".ListMain").trigger("click");
    expect(wrapper.emitted("update:selected")?.at(-1)).toEqual(["b"]);
    expect(wrapper.emitted("select")?.[0]?.[1]).toBe(1);
    expect(wrapper.emitted("item-click")).toHaveLength(1);
    expect(rows[0].attributes("data-selected")).toBeUndefined();
    expect(rows[1].attributes("data-selected")).toBe("true");

    expect(rows[2].find(".ListMain").attributes("disabled")).toBeDefined();
    await rows[1].find(".ListAction").trigger("click");
    expect(wrapper.emitted("select")).toHaveLength(1);
  });

  it("does not select options without a value and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(List, {
      props: {
        items: [{ label: "No value" }, { label: "Also none" }],
        selectable: true,
      },
    });
    expect(wrapper.find("[data-interactive]").exists()).toBe(false);
    await wrapper.find(".ListMain").trigger("click");
    expect(wrapper.emitted("update:selected")).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("emits item-click without selecting when clickable", async () => {
    const wrapper = mount(List, {
      props: { items, clickable: true, selected: "a" },
    });
    expect(wrapper.find("[data-selected]").exists()).toBe(false);
    await wrapper.findAll("button.ListMain")[1].trigger("click");
    const [item, index] = wrapper.emitted("item-click")![0] as [
      ListOption,
      number,
    ];
    expect([item.value, index]).toEqual(["b", 1]);
    expect(wrapper.emitted("update:selected")).toBeUndefined();
  });

  it("renders href and to as links, navigating to with the router", async () => {
    const push = vi.fn();
    const $router = { push, resolve: (to: string) => ({ href: `#${to}` }) };
    const wrapper = mount(List, {
      props: {
        items: [
          { value: "docs", label: "Docs", href: "https://example.com" },
          { value: "map", label: "Map", to: "/map" },
          { value: "off", label: "Off", to: "/off", disabled: true },
        ],
        selectable: true,
        selected: "map",
      },
      global: { config: { globalProperties: { $router } } },
    });
    const links = wrapper.findAll("a.ListMain");
    expect(links.map((a) => a.attributes("href"))).toEqual([
      "https://example.com",
      "#/map",
    ]);
    expect(links[1].attributes("aria-current")).toBe("page");

    await links[1].trigger("click", { button: 0 });
    expect(push).toHaveBeenCalledWith("/map");

    await links[0].trigger("click", { button: 0 });
    expect(push).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("item-click")).toHaveLength(2);

    await links[1].trigger("click", { button: 0, metaKey: true });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("uses to as a plain href without a router", () => {
    const wrapper = mount(List, {
      props: { items: [{ label: "Map", to: "/map" }] },
    });
    expect(wrapper.find("a.ListMain").attributes("href")).toBe("/map");
  });

  it("opens a menu from each row's action, varying per row", async () => {
    const wrapper = mount(List, {
      props: {
        items,
        itemActionLabel: "Actions",
        itemMenu: (item: ListOption) =>
          item.value === "c"
            ? []
            : [
                { value: "rename", label: `Rename ${item.label}` },
                { value: "delete", label: "Delete", danger: true },
              ],
      },
    });
    const menus = wrapper.findAllComponents(Menu);
    expect(menus).toHaveLength(2);
    expect(menus[1].props("items")[0].label).toBe("Rename Beta");
    expect(menus[0].props("icon")).toBe("more_horiz");
    await vi.waitFor(() =>
      expect(wrapper.findAll("button[aria-haspopup]")).toHaveLength(2),
    );
    const trigger = wrapper.findAll("li")[1].find("button[aria-haspopup]");
    expect(trigger.attributes("aria-label")).toBe("Actions: Beta");
    expect(wrapper.findAll("li")[2].find(".ListActions").exists()).toBe(false);

    menus[1].vm.$emit("select", menus[1].props("items")[1], 1);
    const [option, item, index] = wrapper.emitted("item-menu-select")![0] as [
      { value: string },
      ListOption,
      number,
    ];
    expect([option.value, item.value, index]).toEqual(["delete", "b", 1]);
    expect(wrapper.emitted("item-action")).toBeUndefined();
  });

  it("opens a menu from the header action", () => {
    const wrapper = mount(List, {
      props: {
        items,
        headerAction: "add",
        headerActionLabel: "Add",
        headerMenu: [{ value: "blank", label: "Blank scenario" }],
      },
    });
    const menu = wrapper.findComponent(Menu);
    expect(wrapper.find(".ListHeader").exists()).toBe(true);
    expect(menu.props("icon")).toBe("add");
    expect(menu.props("label")).toBe("Add");
    menu.vm.$emit("select", menu.props("items")[0], 0);
    expect(wrapper.emitted("header-menu-select")?.[0]?.[1]).toBe(0);
  });
});
