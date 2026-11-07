import { describe, it, expect, vi, afterEach } from "vitest";
import { DOMWrapper, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ChartMenu from "./ChartMenu.vue";
import * as download from "./download.js";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount();
});

function mountMenu(
  props: Partial<InstanceType<typeof ChartMenu>["$props"]> = {},
) {
  const items = [
    { label: "Fullscreen", action: vi.fn() },
    { label: "Save SVG", action: vi.fn() },
    { label: "Download CSV", action: vi.fn() },
  ];
  const wrapper = mount(ChartMenu, {
    props: { items, ...props },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return { wrapper, items };
}

const trigger = (w: VueWrapper) => w.find('[aria-label="Chart options"]');
// The menu is teleported to <body>, outside the wrapper's subtree.
const menu = () => new DOMWrapper(document.querySelector('[role="menu"]'));
const itemEls = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
    (el) => new DOMWrapper(el),
  );
const rect = (r: Partial<DOMRect>) => () => r as DOMRect;

describe("ChartMenu", () => {
  it("renders nothing with no items, unless fullscreen needs its close button", () => {
    const empty = mount(ChartMenu, { props: { items: [] } });
    const fullscreen = mount(ChartMenu, {
      props: { items: [], isFullscreen: true },
    });
    wrappers.push(empty, fullscreen);
    expect(empty.find(".chart-menu-trigger-area").exists()).toBe(false);
    expect(fullscreen.find('[aria-label="Collapse"]').exists()).toBe(true);
  });

  it("renders a single item as a plain button", () => {
    const action = vi.fn();
    const wrapper = mount(ChartMenu, {
      props: { items: [{ label: "Save PNG", action }] },
    });
    wrappers.push(wrapper);
    expect(trigger(wrapper).exists()).toBe(false);
    wrapper.find('[aria-label="Save PNG"]').trigger("click");
    expect(action).toHaveBeenCalledOnce();
  });

  it("opens on click with menu semantics and closes on item select", async () => {
    const { wrapper, items } = mountMenu();
    const button = trigger(wrapper);
    expect(button.attributes("aria-haspopup")).toBe("menu");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.attributes("data-state")).toBe("closed");
    expect(menu().exists()).toBe(false);

    await button.trigger("click");
    expect(button.attributes("aria-expanded")).toBe("true");
    expect(button.attributes("data-state")).toBe("open");
    expect(menu().element.parentElement).toBe(document.body);
    expect(menu().attributes("aria-labelledby")).toBe(button.attributes("id"));
    expect(button.attributes("aria-controls")).toBe(menu().attributes("id"));
    expect(itemEls().map((i) => i.text())).toEqual([
      "Fullscreen",
      "Save SVG",
      "Download CSV",
    ]);

    await itemEls()[1].trigger("click");
    expect(items[1].action).toHaveBeenCalledOnce();
    expect(menu().exists()).toBe(false);
    expect(document.activeElement).toBe(button.element);
  });

  it("forwards aria-pressed to toggle items", async () => {
    const { wrapper } = mountMenu({
      items: [
        { label: "Fullscreen", action: vi.fn(), ariaPressed: true },
        { label: "Save SVG", action: vi.fn() },
      ],
    });
    await trigger(wrapper).trigger("click");
    expect(itemEls()[0].attributes("aria-pressed")).toBe("true");
    expect(itemEls()[1].attributes("aria-pressed")).toBeUndefined();
  });

  it("opens from the keyboard onto the first or last item and cycles", async () => {
    const { wrapper } = mountMenu();
    const button = trigger(wrapper);

    await button.trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(document.activeElement).toBe(itemEls()[0].element);

    await menu().trigger("keydown", { key: "ArrowUp" });
    expect(document.activeElement).toBe(itemEls()[2].element);
    await menu().trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement).toBe(itemEls()[0].element);
    await menu().trigger("keydown", { key: "End" });
    expect(document.activeElement).toBe(itemEls()[2].element);
    await menu().trigger("keydown", { key: "Home" });
    expect(document.activeElement).toBe(itemEls()[0].element);

    await menu().trigger("keydown", { key: "Escape" });
    expect(menu().exists()).toBe(false);
    expect(document.activeElement).toBe(button.element);

    await button.trigger("keydown", { key: "ArrowUp" });
    await nextTick();
    expect(document.activeElement).toBe(itemEls()[2].element);
  });

  it("closes on a pointerdown outside and when focus leaves", async () => {
    const { wrapper } = mountMenu();
    await trigger(wrapper).trigger("click");
    expect(menu().exists()).toBe(true);

    // Inside the teleported menu: stays open.
    itemEls()[0].element.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    await nextTick();
    expect(menu().exists()).toBe(true);

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    await nextTick();
    expect(menu().exists()).toBe(false);

    await trigger(wrapper).trigger("click");
    // A blur with no new target (Safari mousedown on the trigger) is not
    // focus leaving.
    await menu().trigger("focusout", { relatedTarget: null });
    expect(menu().exists()).toBe(true);
    await menu().trigger("focusout", { relatedTarget: document.body });
    expect(menu().exists()).toBe(false);
  });

  it("toggles closed from the trigger even when the menu blurs first", async () => {
    const { wrapper } = mountMenu();
    await trigger(wrapper).trigger("click");
    await menu().trigger("focusout", { relatedTarget: null });
    await trigger(wrapper).trigger("click");
    expect(menu().exists()).toBe(false);
  });

  it("returns focus to the trigger on Tab so the default move continues from the chart", async () => {
    const { wrapper } = mountMenu();
    await trigger(wrapper).trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      cancelable: true,
      bubbles: true,
    });
    menu().element.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(false);
    expect(menu().exists()).toBe(false);
    expect(document.activeElement).toBe(trigger(wrapper).element);
  });

  it("stops listening for outside clicks and scroll once closed", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { wrapper } = mountMenu();
    await trigger(wrapper).trigger("click");
    expect(add).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    expect(add).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    await menu().trigger("keydown", { key: "Escape" });
    expect(remove).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      true,
    );
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    add.mockRestore();
    remove.mockRestore();
  });

  it("is placed under the trigger's right edge and follows it on scroll", async () => {
    const { wrapper } = mountMenu();
    const button = trigger(wrapper).element as HTMLElement;
    button.getBoundingClientRect = rect({ top: 100, bottom: 128, right: 500 });
    await trigger(wrapper).trigger("click");
    const el = menu().element as HTMLElement;
    el.getBoundingClientRect = rect({ width: 140, height: 80 });
    document.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(el.style.top).toBe("132px");
    expect(el.style.left).toBe("360px");

    button.getBoundingClientRect = rect({ top: 50, bottom: 78, right: 500 });
    document.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(el.style.top).toBe("82px");
  });

  it("flips above the trigger when there is no room below", async () => {
    const { wrapper } = mountMenu();
    const button = trigger(wrapper).element as HTMLElement;
    const bottom = window.innerHeight - 10;
    button.getBoundingClientRect = rect({
      top: bottom - 28,
      bottom,
      right: 500,
    });
    await trigger(wrapper).trigger("click");
    const el = menu().element as HTMLElement;
    el.getBoundingClientRect = rect({ width: 140, height: 80 });
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(el.style.top).toBe(`${bottom - 28 - 4 - 80}px`);
  });

  it("swaps to the close button in fullscreen", async () => {
    const { wrapper } = mountMenu();
    await trigger(wrapper).trigger("click");
    await wrapper.setProps({ isFullscreen: true });
    expect(menu().exists()).toBe(false);
    expect(trigger(wrapper).exists()).toBe(false);
    await wrapper.find('[aria-label="Collapse"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});

describe("ChartMenu clipboard items", () => {
  const items = [
    { label: "Save PNG", action: vi.fn() },
    { label: "Copy PNG", action: vi.fn(), needsClipboard: true },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds them after mount, so the first render matches the server", async () => {
    const wrapper = mount(ChartMenu, { props: { items } });
    wrappers.push(wrapper);
    expect(wrapper.find(".chart-menu-single").exists()).toBe(true);
    await nextTick();
    expect(wrapper.find(".chart-menu-single").exists()).toBe(false);
    expect(trigger(wrapper).exists()).toBe(true);
  });

  it("does not update a menu with nothing to reveal", async () => {
    const updated = vi.fn();
    const wrapper = mount(ChartMenu, {
      props: { items: [items[0]] },
      global: {
        mixins: [
          {
            updated(this: { $options: unknown }) {
              if (this.$options === ChartMenu) updated();
            },
          },
        ],
      },
    });
    wrappers.push(wrapper);
    await nextTick();
    expect(updated).not.toHaveBeenCalled();
  });

  it("leaves them out where the clipboard is unavailable", async () => {
    vi.spyOn(download, "canCopyToClipboard").mockReturnValue(false);
    const wrapper = mount(ChartMenu, { props: { items } });
    const onlyCopy = mount(ChartMenu, { props: { items: [items[1]] } });
    wrappers.push(wrapper, onlyCopy);
    await nextTick();
    expect(wrapper.find(".chart-menu-single").attributes("aria-label")).toBe(
      "Save PNG",
    );
    expect(onlyCopy.find(".chart-menu-trigger-area").exists()).toBe(false);
  });
});

describe("ChartMenu buttons", () => {
  it("never submits a surrounding form, and names a lone button visually", () => {
    const single = mount(ChartMenu, {
      props: { items: [{ label: "Download CSV", action: vi.fn() }] },
    });
    const close = mount(ChartMenu, {
      props: { items: [], isFullscreen: true },
    });
    wrappers.push(single, close);
    const button = single.find(".chart-menu-single");
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("title")).toBe("Download CSV");
    expect(close.find(".chart-close-button").attributes("type")).toBe("button");
  });

  it("closes when its items empty, and stays closed when they return", async () => {
    const items = [
      { label: "A", action: vi.fn() },
      { label: "B", action: vi.fn() },
    ];
    const wrapper = mount(ChartMenu, {
      props: { items, forceDropdown: true },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await trigger(wrapper).trigger("click");
    expect(menu().exists()).toBe(true);
    await wrapper.setProps({ items: [] });
    await wrapper.setProps({ items });
    await nextTick();
    expect(menu().exists()).toBe(false);
  });
});

describe("ChartMenu icons", () => {
  it("draws a lone item's own icon, and download when it has none", () => {
    const iconPath = (item: object) => {
      const wrapper = mount(ChartMenu, {
        props: { items: [{ label: "Only", action: vi.fn(), ...item }] },
      });
      wrappers.push(wrapper);
      return wrapper.find(".chart-menu-single path").attributes("d");
    };
    expect(iconPath({ icon: "expand" })).toBe(
      "M8 1h5v5M13 1L8 6M6 13H1V8M1 13l5-5",
    );
    expect(iconPath({})).toBe("M7 1v8M3 6l4 4 4-4M2 13h10");
  });

  it("draws an item's icon before its label, hidden from AT", async () => {
    const wrapper = mount(ChartMenu, {
      props: {
        items: [
          { label: "Copy SVG", icon: "copy", action: vi.fn() },
          { label: "Plain", action: vi.fn() },
        ],
      },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await trigger(wrapper).trigger("click");
    const [withIcon, plain] = itemEls();
    const icon = withIcon.find("svg.chart-menu-item-icon");
    expect(icon.exists()).toBe(true);
    expect(icon.attributes("aria-hidden")).toBe("true");
    expect(withIcon.text()).toBe("Copy SVG");
    expect(plain.find("svg").exists()).toBe(false);
  });
});
