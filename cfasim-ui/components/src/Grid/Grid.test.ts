import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Grid from "./Grid.vue";

function gridStyle(props: Record<string, unknown> = {}) {
  const wrapper = mount(Grid, { props, slots: { default: "x" } });
  return wrapper.find(".grid").attributes("style") ?? "";
}

describe("Grid", () => {
  it("renders slot content", () => {
    const wrapper = mount(Grid, { slots: { default: "Hello" } });
    expect(wrapper.text()).toBe("Hello");
  });

  it("defaults to 2 equal columns", () => {
    expect(gridStyle()).toContain("grid-template-columns: repeat(2, 1fr)");
  });

  it("renders N equal columns when cols is a number", () => {
    expect(gridStyle({ cols: 4 })).toContain(
      "grid-template-columns: repeat(4, 1fr)",
    );
  });

  it("renders proportional columns when cols is a number array", () => {
    expect(gridStyle({ cols: [2, 3, 1] })).toContain(
      "grid-template-columns: 2fr 3fr 1fr",
    );
  });

  it("passes string column sizes through", () => {
    expect(gridStyle({ cols: ["200px", "1fr", "auto"] })).toContain(
      "grid-template-columns: 200px 1fr auto",
    );
  });

  it("uses auto-fit when minColWidth is set", () => {
    expect(gridStyle({ minColWidth: "200px" })).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))",
    );
  });

  it("minColWidth overrides cols", () => {
    expect(gridStyle({ cols: 4, minColWidth: "150px" })).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))",
    );
  });

  it("sets --grid-cols-small to the default when colsSmall is not given", () => {
    const style = gridStyle({ cols: 3 });
    expect(style).toContain("--grid-cols-small: repeat(3, 1fr)");
  });

  it("sets --grid-cols-small when colsSmall is given (number)", () => {
    const style = gridStyle({ cols: 3, colsSmall: 1 });
    expect(style).toContain("grid-template-columns: repeat(3, 1fr)");
    expect(style).toContain("--grid-cols-small: repeat(1, 1fr)");
  });

  it("sets --grid-cols-small when colsSmall is given (array)", () => {
    const style = gridStyle({ cols: 3, colsSmall: [1, 1] });
    expect(style).toContain("--grid-cols-small: 1fr 1fr");
  });

  it("ignores colsSmall when minColWidth is set", () => {
    const style = gridStyle({ minColWidth: "150px", colsSmall: 1 });
    expect(style).toContain(
      "--grid-cols-small: repeat(auto-fit, minmax(150px, 1fr))",
    );
  });

  it.each([
    ["small", "var(--space-2)"],
    ["medium", "var(--space-4)"],
    ["large", "var(--space-6)"],
    ["none", "0"],
  ] as const)("maps %s gap token to %s", (gap, expected) => {
    expect(gridStyle({ gap })).toContain(`gap: ${expected}`);
  });

  function findBreakpointStyle(breakpoint: string) {
    return document.head.querySelector<HTMLStyleElement>(
      `style[data-cfasim-grid-bp="${breakpoint}"]`,
    );
  }

  it("injects a head <style> with the default 640px breakpoint", () => {
    const wrapper = mount(Grid, {
      props: { cols: 3, colsSmall: 1 },
      slots: { default: "x" },
      attachTo: document.body,
    });
    const style = findBreakpointStyle("640px");
    expect(style?.textContent).toContain("@container (max-width: 640px)");
    expect(style?.textContent).toContain("var(--grid-cols-small)");
    wrapper.unmount();
  });

  it("uses a custom breakpoint when set", () => {
    const wrapper = mount(Grid, {
      props: { cols: 3, colsSmall: 1, breakpoint: "480px" },
      slots: { default: "x" },
      attachTo: document.body,
    });
    expect(findBreakpointStyle("480px")?.textContent).toContain(
      "@container (max-width: 480px)",
    );
    wrapper.unmount();
  });

  it("sanitizes a malicious breakpoint to the default", () => {
    const wrapper = mount(Grid, {
      props: { breakpoint: "640px} body { display: none } /*" },
      slots: { default: "x" },
      attachTo: document.body,
    });
    expect(findBreakpointStyle("640px")?.textContent).toContain(
      "@container (max-width: 640px)",
    );
    expect(document.body.style.display).not.toBe("none");
    wrapper.unmount();
  });

  it("shares a single <style> across multiple instances at the same breakpoint", () => {
    const a = mount(Grid, {
      props: { breakpoint: "720px", colsSmall: 1 },
      slots: { default: "a" },
      attachTo: document.body,
    });
    const b = mount(Grid, {
      props: { breakpoint: "720px", colsSmall: 1 },
      slots: { default: "b" },
      attachTo: document.body,
    });
    const sheets = document.head.querySelectorAll(
      'style[data-cfasim-grid-bp="720px"]',
    );
    expect(sheets.length).toBe(1);
    a.unmount();
    expect(findBreakpointStyle("720px")).not.toBeNull();
    b.unmount();
    expect(findBreakpointStyle("720px")).toBeNull();
  });

  it("removes the <style> when the last instance unmounts", () => {
    const wrapper = mount(Grid, {
      props: { breakpoint: "900px", colsSmall: 1 },
      slots: { default: "x" },
      attachTo: document.body,
    });
    expect(findBreakpointStyle("900px")).not.toBeNull();
    wrapper.unmount();
    expect(findBreakpointStyle("900px")).toBeNull();
  });

  it("swaps stylesheets when breakpoint prop changes", async () => {
    const wrapper = mount(Grid, {
      props: { breakpoint: "500px", colsSmall: 1 },
      slots: { default: "x" },
      attachTo: document.body,
    });
    expect(findBreakpointStyle("500px")).not.toBeNull();
    await wrapper.setProps({ breakpoint: "800px" });
    expect(findBreakpointStyle("500px")).toBeNull();
    expect(findBreakpointStyle("800px")).not.toBeNull();
    wrapper.unmount();
    expect(findBreakpointStyle("800px")).toBeNull();
  });
});
