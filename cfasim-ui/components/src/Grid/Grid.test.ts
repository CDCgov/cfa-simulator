import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Grid from "./Grid.vue";

const findStyle = (breakpoint: string) =>
  document.head.querySelector<HTMLStyleElement>(
    `style[data-cfasim-grid-bp="${breakpoint}"]`,
  );

describe("Grid", () => {
  it("sanitizes a malicious breakpoint to the default", () => {
    const wrapper = mount(Grid, {
      props: { breakpoint: "640px} body { display: none } /*" },
      slots: { default: "x" },
      attachTo: document.body,
    });
    expect(findStyle("640px")?.textContent).toContain(
      "@container (max-width: 640px)",
    );
    expect(document.body.style.display).not.toBe("none");
    wrapper.unmount();
  });

  it("shares and ref-counts injected breakpoint styles across instances and prop changes", async () => {
    const first = mount(Grid, {
      props: { breakpoint: "720px", colsSmall: 1 },
      slots: { default: "a" },
      attachTo: document.body,
    });
    const second = mount(Grid, {
      props: { breakpoint: "720px", colsSmall: 1 },
      slots: { default: "b" },
      attachTo: document.body,
    });
    expect(
      document.head.querySelectorAll('style[data-cfasim-grid-bp="720px"]'),
    ).toHaveLength(1);
    first.unmount();
    expect(findStyle("720px")).not.toBeNull();
    await second.setProps({ breakpoint: "800px" });
    expect(findStyle("720px")).toBeNull();
    expect(findStyle("800px")).not.toBeNull();
    second.unmount();
    expect(findStyle("800px")).toBeNull();
  });
});
