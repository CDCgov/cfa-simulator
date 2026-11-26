import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import Menu from "./Menu.vue";
import type { MenuOption } from "./Menu.vue";

const items: MenuOption[] = [
  { value: "rename", label: "Rename", icon: "edit" },
  { value: "export", label: "Export", description: "CSV" },
  { value: "off", label: "Archive", disabled: true },
];

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
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
  it("opens on a click made before the async dropdown chunk loads", async () => {
    vi.resetModules();
    const { default: FreshMenu } = await import("./Menu.vue");
    const wrapper = mount(FreshMenu, {
      props: { items, label: "Scenario actions" },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    await wrapper.find("button").trigger("click");
    await vi.waitFor(() => expect(menuItems()).toHaveLength(3));
    expect(wrapper.find("button").attributes("aria-expanded")).toBe("true");
  });

  it("emits select with the option and closes", async () => {
    const wrapper = await openMenu({
      "onUpdate:open": (value: boolean) => wrapper.setProps({ open: value }),
    });
    menuItems()[1].click();
    await flushPromises();
    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({
      value: "export",
    });
    expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);
  });

  it("renders href and to as links, routing to through $router", async () => {
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
    expect(docs.getAttribute("href")).toBe("https://example.com");
    expect(map.getAttribute("href")).toBe("#/map");
    map.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(push).toHaveBeenCalledWith("/map");
  });
});
