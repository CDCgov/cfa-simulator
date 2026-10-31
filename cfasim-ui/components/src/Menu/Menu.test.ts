import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import Menu from "./Menu.vue";
import type { MenuOption } from "./Menu.vue";

const items: MenuOption[] = [
  { value: "rename", label: "Rename", icon: "edit" },
  { value: "export", label: "Export", description: "CSV", swatch: "#c00" },
  { value: "off", label: "Archive", disabled: true },
  { value: "delete", label: "Delete", icon: "delete", danger: true },
];

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount());
  vi.restoreAllMocks();
});

const menuItems = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
];

async function openMenu(props: Record<string, unknown> = {}, opts = {}) {
  const wrapper = mount(Menu, {
    props: { items, label: "Scenario actions", open: true, ...props },
    attachTo: document.body,
    ...opts,
  });
  mounted.push(wrapper);
  await vi.waitFor(() => expect(menuItems().length).toBeGreaterThan(0));
  return wrapper;
}

describe("Menu", () => {
  it("renders the trigger at once and opens on a click made before the dropdown loads", async () => {
    vi.resetModules();
    const { default: FreshMenu } = await import("./Menu.vue");
    const wrapper = mount(FreshMenu, {
      props: { items, label: "Scenario actions" },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    const trigger = wrapper.find("button");
    expect(trigger.attributes("aria-label")).toBe("Scenario actions");
    expect(trigger.attributes("aria-haspopup")).toBeUndefined();
    await trigger.trigger("click");
    await vi.waitFor(() => expect(menuItems()).toHaveLength(4));
    expect(wrapper.find("button").attributes("aria-expanded")).toBe("true");
  });

  it("renders a labeled icon trigger, closed by default", async () => {
    const wrapper = mount(Menu, {
      props: { items, label: "Scenario actions" },
    });
    mounted.push(wrapper);
    await vi.waitFor(() =>
      expect(wrapper.find("button").attributes("aria-haspopup")).toBe("menu"),
    );
    const trigger = wrapper.find("button");
    expect(trigger.attributes("aria-label")).toBe("Scenario actions");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.find(".Icon").exists()).toBe(true);
    expect(menuItems()).toHaveLength(0);
  });

  it("opens to menu items rendered like List rows", async () => {
    await openMenu();
    const rows = menuItems();
    expect(
      rows.map((r) => r.querySelector(".OptionLabel")?.textContent),
    ).toEqual(["Rename", "Export", "Archive", "Delete"]);
    expect(rows[0].querySelector(".OptionIcon")).not.toBeNull();
    expect(rows[1].querySelector(".OptionSwatch")).not.toBeNull();
    expect(
      rows[1].querySelector(".OptionDescription")?.textContent?.trim(),
    ).toBe("CSV");
    expect(rows[2].getAttribute("aria-disabled")).toBe("true");
    expect(rows[3].hasAttribute("data-danger")).toBe(true);
  });

  it("emits select with the option and closes", async () => {
    const wrapper = await openMenu({
      "onUpdate:open": (v: boolean) => wrapper.setProps({ open: v }),
    });
    menuItems()[1].click();
    await flushPromises();
    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({
      value: "export",
    });
    expect(wrapper.emitted("select")?.[0]?.[1]).toBe(1);
    expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);
  });

  it("puts descriptions and swatches at the end when asked", async () => {
    await openMenu({ descriptionPosition: "end", swatchPosition: "end" });
    const end = menuItems()[1].querySelector(".OptionEnd")!;
    expect([...end.children].map((c) => c.className)).toEqual([
      "OptionDescription OptionDescriptionEnd",
      "OptionSwatchEnd",
    ]);
  });

  it("renders href and to as links, routing to through the router", async () => {
    const push = vi.fn();
    const $router = { push, resolve: (to: string) => ({ href: `#${to}` }) };
    await openMenu(
      {
        items: [
          { label: "Docs", href: "https://example.com" },
          { label: "Map", to: "/map" },
        ],
      },
      { global: { config: { globalProperties: { $router } } } },
    );
    const [docs, map] = menuItems();
    expect(docs.tagName).toBe("A");
    expect(docs.getAttribute("href")).toBe("https://example.com");
    expect(map.getAttribute("href")).toBe("#/map");
    map.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(push).toHaveBeenCalledWith("/map");
  });

  it("uses a custom trigger slot", async () => {
    const wrapper = mount(Menu, {
      props: { items },
      slots: { trigger: "<button class='mine'>Options</button>" },
    });
    mounted.push(wrapper);
    await vi.waitFor(() =>
      expect(wrapper.find(".mine").attributes("aria-haspopup")).toBe("menu"),
    );
    expect(wrapper.find(".cfasim-icon-button").exists()).toBe(false);
  });

  it("warns once when the default trigger has no label", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(Menu, { props: { items } });
    mounted.push(wrapper);
    expect(wrapper.find("button").attributes("aria-label")).toBe("more_horiz");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
