import { describe, it, expect, vi, afterEach } from "vitest";
import { DOMWrapper, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ChartMenu from "./ChartMenu.vue";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount();
});

function mountMenu(
  props: Partial<InstanceType<typeof ChartMenu>["$props"]> = {},
) {
  const items = [
    { label: "Fullscreen", action: vi.fn() },
    { label: "Save as SVG", action: vi.fn() },
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
  it("renders a single item as a plain button", () => {
    const action = vi.fn();
    const wrapper = mount(ChartMenu, {
      props: { items: [{ label: "Save as PNG", action }] },
    });
    wrappers.push(wrapper);
    expect(trigger(wrapper).exists()).toBe(false);
    wrapper.find('[aria-label="Save as PNG"]').trigger("click");
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
      "Save as SVG",
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
        { label: "Save as SVG", action: vi.fn() },
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
