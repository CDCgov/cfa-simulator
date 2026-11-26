import { describe, it, expect, vi, afterEach } from "vitest";
import { DOMWrapper, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ChartMenu from "./ChartMenu.vue";
import * as download from "./download.js";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
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

const trigger = (wrapper: VueWrapper) =>
  wrapper.find('[aria-label="Chart options"]');
const menu = () => new DOMWrapper(document.querySelector('[role="menu"]'));
const itemEls = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
    (el) => new DOMWrapper(el),
  );

describe("ChartMenu", () => {
  it("handles empty, single-item, and fullscreen close states", async () => {
    const empty = mount(ChartMenu, { props: { items: [] } });
    const fullscreen = mount(ChartMenu, {
      props: { items: [], isFullscreen: true },
    });
    const action = vi.fn();
    const single = mount(ChartMenu, {
      props: { items: [{ label: "Save PNG", action }] },
    });
    wrappers.push(empty, fullscreen, single);

    expect(empty.find(".chart-menu-trigger-area").exists()).toBe(false);
    await fullscreen.find('[aria-label="Collapse"]').trigger("click");
    expect(fullscreen.emitted("close")).toHaveLength(1);
    await single.find('[aria-label="Save PNG"]').trigger("click");
    expect(action).toHaveBeenCalledOnce();
  });

  it("opens, runs actions, handles keyboard/outside-click close, flips above bottom edge, and cleans up listeners", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { wrapper, items } = mountMenu();
    const button = trigger(wrapper);

    await button.trigger("click");
    expect(button.attributes("aria-expanded")).toBe("true");
    expect(menu().element.parentElement).toBe(document.body);
    expect(add).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    await itemEls()[1].trigger("click");
    expect(items[1].action).toHaveBeenCalledOnce();
    expect(menu().exists()).toBe(false);
    expect(document.activeElement).toBe(button.element);
    expect(remove).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      true,
    );

    await button.trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(document.activeElement).toBe(itemEls()[0].element);
    await menu().trigger("keydown", { key: "ArrowUp" });
    expect(document.activeElement).toBe(itemEls()[2].element);
    await menu().trigger("keydown", { key: "Escape" });
    expect(menu().exists()).toBe(false);

    const bottom = window.innerHeight - 10;
    (button.element as HTMLElement).getBoundingClientRect = () =>
      ({ top: bottom - 28, bottom, right: 500 }) as DOMRect;
    await button.trigger("click");
    const menuEl = menu().element as HTMLElement;
    menuEl.getBoundingClientRect = () =>
      ({ width: 140, height: 80 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(menuEl.style.top).toBe(`${bottom - 28 - 4 - 80}px`);

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    await nextTick();
    expect(menu().exists()).toBe(false);
  });

  it("reveals clipboard items after mount only when clipboard is available", async () => {
    const items = [
      { label: "Save PNG", action: vi.fn() },
      { label: "Copy PNG", action: vi.fn(), needsClipboard: true },
    ];
    const supported = mount(ChartMenu, { props: { items } });
    wrappers.push(supported);
    expect(supported.find(".chart-menu-single").exists()).toBe(true);
    await nextTick();
    expect(trigger(supported).exists()).toBe(true);

    vi.spyOn(download, "canCopyToClipboard").mockReturnValue(false);
    const unsupported = mount(ChartMenu, { props: { items } });
    wrappers.push(unsupported);
    await nextTick();
    expect(
      unsupported.find(".chart-menu-single").attributes("aria-label"),
    ).toBe("Save PNG");
  });
});
