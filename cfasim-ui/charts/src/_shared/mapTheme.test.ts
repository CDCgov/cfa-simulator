import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMapThemeResolver,
  visible,
  withVarFallback,
  LIGHT_FILL,
  LIGHT_STROKE,
  LIGHT_HIGHLIGHT,
} from "./mapTheme.js";

let container: HTMLElement;
let overrides: Map<Element, string>;
let getComputedStyleSpy: ReturnType<typeof vi.spyOn>;

const channels = () =>
  Array.from(
    container.querySelector("[data-cfasim-map-probe]")!.children,
  ) as HTMLElement[];

const fireTransition = (el: Element) =>
  el.dispatchEvent(new Event("transitionstart", { bubbles: true }));

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  overrides = new Map();
  getComputedStyleSpy = vi
    .spyOn(window, "getComputedStyle")
    .mockImplementation((el) => {
      const inline = (el as HTMLElement).style.color;
      return {
        color:
          overrides.get(el as Element) ??
          (/var\(|light-dark\(/.test(inline) ? "" : inline),
      } as CSSStyleDeclaration;
    });
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mapTheme helpers", () => {
  it("visible drops transparent colors and withVarFallback rewrites bare var()", () => {
    expect(visible("")).toBeUndefined();
    expect(visible("transparent")).toBeUndefined();
    expect(visible("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(visible("rgba(0, 0, 0, 0.5)")).toBe("rgba(0, 0, 0, 0.5)");

    expect(withVarFallback("var(--x)", "#abc")).toBe("var(--x, #abc)");
    expect(withVarFallback("var(--x, red)", "#abc")).toBe("var(--x, red)");
    expect(withVarFallback("var(--x, var(--y))", "#abc")).toBe(
      "var(--x, var(--y, #abc))",
    );
  });
});

describe("createMapThemeResolver", () => {
  it("resolves all channels through computed style and caches equal themes", () => {
    const resolver = createMapThemeResolver(container, () => {});
    channels().forEach((span, idx) =>
      overrides.set(span, `rgb(${idx + 1}, ${idx + 1}, ${idx + 1})`),
    );

    const input = {
      fill: "#a00",
      stroke: "#0b0",
      strokeWidth: 2,
      borders: "#333",
      countyBorders: "#999",
      hsaBorders: "#fff",
      outline: "#d00",
      background: "#00c",
      highlight: "#f0f",
    };
    const resolved = resolver.resolve(input);
    expect(resolved).toMatchObject({
      fill: "rgb(1, 1, 1)",
      stroke: "rgb(2, 2, 2)",
      strokeWidth: 2,
      borders: "rgb(3, 3, 3)",
      countyBorders: "rgb(4, 4, 4)",
      hsaBorders: "rgb(5, 5, 5)",
      outline: "rgb(6, 6, 6)",
      background: "rgb(7, 7, 7)",
      highlight: "rgb(8, 8, 8)",
    });

    const reads = getComputedStyleSpy.mock.calls.length;
    expect(resolver.resolve({ ...input })).toBe(resolved);
    expect(getComputedStyleSpy.mock.calls.length).toBe(reads);
  });

  it("keeps optional channels off unless visible and falls back to light constants when unreadable", () => {
    const resolver = createMapThemeResolver(container, () => {});
    const unreadable = resolver.resolve(undefined);
    expect(unreadable.fill).toBe(LIGHT_FILL);
    expect(unreadable.stroke).toBe(LIGHT_STROKE);
    expect(unreadable.highlight).toBe(LIGHT_HIGHLIGHT);
    expect(resolver.unresolved()).toBe(true);
    expect(resolver.resolve({ fill: "not-a-color" }).fill).not.toBe(
      "not-a-color",
    );

    const spans = channels();
    overrides.set(spans[0]!, "rgb(0, 0, 1)");
    overrides.set(spans[1]!, "rgb(2, 2, 2)");
    resolver.invalidate();
    const defaults = resolver.resolve(undefined);
    expect(defaults.borders).toBe("rgb(2, 2, 2)");
    expect(defaults.outline).toBeUndefined();
    expect(defaults.countyBorders).toBeUndefined();
    expect(defaults.hsaBorders).toBeUndefined();
    expect(defaults.background).toBeUndefined();
  });

  it("notifies on transitionstart/recheck, watches palette swatches, and cleans up on destroy", () => {
    let calls = 0;
    const resolver = createMapThemeResolver(container, () => calls++);
    const [fillEl] = channels();
    resolver.resolve({ fill: "#a00" });

    fireTransition(fillEl!);
    expect(calls).toBe(0);

    overrides.set(fillEl!, "rgb(9, 9, 9)");
    fireTransition(fillEl!);
    expect(calls).toBe(1);
    expect(resolver.resolve({ fill: "#a00" }).fill).toBe("rgb(9, 9, 9)");

    const palette = resolver.resolvePalette(["#111", "#222"], ["#f1", "#f2"]);
    expect(resolver.resolvePalette(["#111", "#222"], ["#f1", "#f2"])).toBe(
      palette,
    );
    const swatch = container.querySelector<HTMLElement>(
      "[data-cfasim-map-swatch='0']",
    )!;
    overrides.set(swatch, "rgb(5, 5, 5)");
    fireTransition(swatch);
    expect(calls).toBe(2);
    expect(resolver.resolvePalette(["#111", "#222"], [])).toEqual([
      "rgb(5, 5, 5)",
      "#222",
    ]);

    resolver.destroy();
    expect(container.querySelector("[data-cfasim-map-probe]")).toBeNull();
    overrides.set(fillEl!, "rgb(7, 7, 7)");
    fireTransition(fillEl!);
    expect(calls).toBe(2);
  });
});
