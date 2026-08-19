import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMapThemeResolver,
  mapThemeDefaults,
  themeEquals,
  visible,
  withVarFallback,
  LIGHT_FILL,
  LIGHT_STROKE,
  LIGHT_HIGHLIGHT,
} from "./mapTheme.js";

let container: HTMLElement;
// per-element computed-color overrides; happy-dom neither resolves var()
// nor light-dark(), so the spy stands in for the browser's resolution
let overrides: Map<Element, string>;
let gcs: ReturnType<typeof vi.spyOn>;

// Channel order matches createMapThemeResolver:
// fill, stroke, borders, countyBorders, hsaBorders, outline, background,
// highlight
const CHANNELS = 8;
const FILL = 0;
const STROKE = 1;
const BORDERS = 2;
const COUNTY_BORDERS = 3;
const HSA_BORDERS = 4;
const OUTLINE = 5;
const BG = 6;
const HIGHLIGHT = 7;

function channels(): HTMLElement[] {
  return Array.from(
    container.querySelector("[data-cfasim-map-probe]")!.children,
  ) as HTMLElement[];
}

function fire(el: Element) {
  el.dispatchEvent(new Event("transitionstart", { bubbles: true }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  overrides = new Map();
  gcs = vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el) =>
      ({
        color: overrides.get(el as Element) ?? (el as HTMLElement).style.color,
      }) as CSSStyleDeclaration,
  );
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("themeEquals", () => {
  it("treats undefined and empty as equal", () => {
    expect(themeEquals(undefined, {})).toBe(true);
    expect(themeEquals({}, undefined)).toBe(true);
    expect(themeEquals(undefined, undefined)).toBe(true);
  });

  it("compares values shallowly", () => {
    expect(
      themeEquals(
        { fill: "#a00", stroke: "#0b0", strokeWidth: 1, background: "#fff" },
        { fill: "#a00", stroke: "#0b0", strokeWidth: 1, background: "#fff" },
      ),
    ).toBe(true);
    expect(themeEquals({ fill: "#a00" }, { fill: "#a01" })).toBe(false);
    expect(themeEquals({ stroke: "#0b0" }, {})).toBe(false);
    expect(themeEquals({ strokeWidth: 1 }, { strokeWidth: 0 })).toBe(false);
    expect(themeEquals({ background: "#fff" }, {})).toBe(false);
    expect(themeEquals({ outline: "#000" }, {})).toBe(false);
    expect(themeEquals({ outlineWidth: 2 }, { outlineWidth: 1 })).toBe(false);
    expect(themeEquals({ borders: "#333" }, {})).toBe(false);
    expect(themeEquals({ bordersWidth: 2 }, { bordersWidth: 1 })).toBe(false);
    expect(themeEquals({ countyBorders: "#999" }, {})).toBe(false);
    expect(
      themeEquals({ countyBordersWidth: 1 }, { countyBordersWidth: 0.5 }),
    ).toBe(false);
    expect(themeEquals({ hsaBorders: "#fff" }, {})).toBe(false);
    expect(themeEquals({ hsaBordersWidth: 1 }, { hsaBordersWidth: 0.5 })).toBe(
      false,
    );
    expect(themeEquals({ highlight: "#f00" }, {})).toBe(false);
  });
});

describe("visible", () => {
  it("treats any fully transparent serialization as off", () => {
    expect(visible("")).toBeUndefined();
    expect(visible("transparent")).toBeUndefined();
    expect(visible("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(visible("rgba(255, 0, 0, 0)")).toBeUndefined();
    expect(visible("hsla(120, 50%, 50%, 0)")).toBeUndefined();
    expect(visible("color(srgb 1 0 0 / 0)")).toBeUndefined();
    expect(visible("lab(50% 0 0 / 0.0)")).toBeUndefined();
  });

  it("keeps opaque and semi-transparent colors", () => {
    expect(visible("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(visible("rgb(0, 0, 0)")).toBe("rgb(0, 0, 0)");
    expect(visible("rgba(0, 0, 0, 0.5)")).toBe("rgba(0, 0, 0, 0.5)");
    expect(visible("color(srgb 1 0 0 / 0.25)")).toBe(
      "color(srgb 1 0 0 / 0.25)",
    );
    expect(visible("#cbd5e1")).toBe("#cbd5e1");
  });
});

describe("withVarFallback", () => {
  it("adds the fallback to bare var() references", () => {
    expect(withVarFallback("var(--x)", "#abc")).toBe("var(--x, #abc)");
    expect(withVarFallback("var( --x-y )", "#abc")).toBe("var( --x-y , #abc)");
  });

  it("leaves var() with an existing fallback alone", () => {
    expect(withVarFallback("var(--x, red)", "#abc")).toBe("var(--x, red)");
  });

  it("rewrites bare var() nested inside a fallback", () => {
    expect(withVarFallback("var(--x, var(--y))", "#abc")).toBe(
      "var(--x, var(--y, #abc))",
    );
  });

  it("rewrites bare var() nested in other functions", () => {
    expect(withVarFallback("color-mix(in srgb, var(--a), red)", "#abc")).toBe(
      "color-mix(in srgb, var(--a, #abc), red)",
    );
  });

  it("passes plain colors through", () => {
    expect(withVarFallback("light-dark(#111, #999)", "#abc")).toBe(
      "light-dark(#111, #999)",
    );
  });
});

describe("createMapThemeResolver", () => {
  it("appends a hidden eight-channel probe", () => {
    createMapThemeResolver(container, () => {});
    const probe = container.querySelector<HTMLElement>(
      "[data-cfasim-map-probe]",
    )!;
    expect(probe.getAttribute("aria-hidden")).toBe("true");
    expect(probe.style.visibility).toBe("hidden");
    const spans = channels();
    expect(spans).toHaveLength(CHANNELS);
    for (const s of spans) {
      expect(s.style.getPropertyValue("transition")).toContain("step-start");
      expect(s.style.getPropertyPriority("transition")).toBe("important");
    }
  });

  it("resolves string values through computed style", () => {
    const r = createMapThemeResolver(container, () => {});
    const spans = channels();
    overrides.set(spans[FILL]!, "rgb(1, 1, 1)");
    overrides.set(spans[STROKE]!, "rgb(2, 2, 2)");
    overrides.set(spans[BORDERS]!, "rgb(3, 3, 3)");
    overrides.set(spans[COUNTY_BORDERS]!, "rgb(4, 4, 4)");
    overrides.set(spans[HSA_BORDERS]!, "rgb(5, 5, 5)");
    overrides.set(spans[OUTLINE]!, "rgb(6, 6, 6)");
    overrides.set(spans[BG]!, "rgb(7, 7, 7)");
    overrides.set(spans[HIGHLIGHT]!, "rgb(8, 8, 8)");
    const t = r.resolve({
      fill: "#a00",
      stroke: "#0b0",
      strokeWidth: 2,
      borders: "#333",
      bordersWidth: 1.5,
      countyBorders: "#999",
      countyBordersWidth: 0.5,
      hsaBorders: "#fff",
      hsaBordersWidth: 0.75,
      outline: "#d00",
      outlineWidth: 1.25,
      background: "#00c",
      highlight: "#f0f",
    });
    expect(t).toEqual({
      fill: "rgb(1, 1, 1)",
      stroke: "rgb(2, 2, 2)",
      strokeWidth: 2,
      borders: "rgb(3, 3, 3)",
      bordersWidth: 1.5,
      countyBorders: "rgb(4, 4, 4)",
      countyBordersWidth: 0.5,
      hsaBorders: "rgb(5, 5, 5)",
      hsaBordersWidth: 0.75,
      outline: "rgb(6, 6, 6)",
      outlineWidth: 1.25,
      background: "rgb(7, 7, 7)",
      highlight: "rgb(8, 8, 8)",
    });
  });

  it("keeps the outline off unless a visible color resolves", () => {
    const r = createMapThemeResolver(container, () => {});
    const spans = channels();
    overrides.set(spans[FILL]!, "rgb(0, 0, 1)");
    expect(r.resolve(undefined).outline).toBeUndefined();
    r.invalidate();
    expect(r.resolve({ outline: "transparent" }).outline).toBeUndefined();
    overrides.set(spans[OUTLINE]!, "rgba(0, 0, 0, 0)");
    r.invalidate();
    expect(r.resolve({ outline: "#d00" }).outline).toBeUndefined();
    overrides.set(spans[OUTLINE]!, "rgb(4, 4, 4)");
    r.invalidate();
    expect(r.resolve({ outline: "#d00" }).outline).toBe("rgb(4, 4, 4)");
  });

  it("keeps county borders off unless a visible color resolves", () => {
    const r = createMapThemeResolver(container, () => {});
    const spans = channels();
    overrides.set(spans[FILL]!, "rgb(0, 0, 1)");
    expect(r.resolve(undefined).countyBorders).toBeUndefined();
    r.invalidate();
    expect(
      r.resolve({ countyBorders: "transparent" }).countyBorders,
    ).toBeUndefined();
    overrides.set(spans[COUNTY_BORDERS]!, "rgb(4, 4, 4)");
    r.invalidate();
    expect(r.resolve({ countyBorders: "#999" }).countyBorders).toBe(
      "rgb(4, 4, 4)",
    );
  });

  it("keeps HSA borders off unless a visible color resolves", () => {
    const r = createMapThemeResolver(container, () => {});
    const spans = channels();
    overrides.set(spans[FILL]!, "rgb(0, 0, 1)");
    expect(r.resolve(undefined).hsaBorders).toBeUndefined();
    r.invalidate();
    expect(r.resolve({ hsaBorders: "transparent" }).hsaBorders).toBeUndefined();
    overrides.set(spans[HSA_BORDERS]!, "rgb(5, 5, 5)");
    r.invalidate();
    expect(r.resolve({ hsaBorders: "#fff" }).hsaBorders).toBe("rgb(5, 5, 5)");
  });

  it("keeps the background off unless a visible color resolves", () => {
    const r = createMapThemeResolver(container, () => {});
    const spans = channels();
    overrides.set(spans[FILL]!, "rgb(0, 0, 1)");
    expect(r.resolve(undefined).background).toBeUndefined();
    r.invalidate();
    expect(r.resolve({ background: "transparent" }).background).toBeUndefined();
    overrides.set(spans[BG]!, "rgb(8, 8, 8)");
    r.invalidate();
    expect(r.resolve(undefined).background).toBe("rgb(8, 8, 8)");
  });

  it("falls borders back to the stroke unless a visible color resolves", () => {
    const r = createMapThemeResolver(container, () => {});
    const spans = channels();
    overrides.set(spans[FILL]!, "rgb(0, 0, 1)");
    overrides.set(spans[STROKE]!, "rgb(2, 2, 2)");
    expect(r.resolve(undefined).borders).toBe("rgb(2, 2, 2)");
    overrides.set(spans[BORDERS]!, "rgb(3, 3, 3)");
    r.invalidate();
    expect(r.resolve({ borders: "#333" }).borders).toBe("rgb(3, 3, 3)");
    overrides.set(spans[BORDERS]!, "rgba(0, 0, 0, 0)");
    r.invalidate();
    expect(r.resolve({ borders: "transparent" }).borders).toBe("rgb(2, 2, 2)");
  });

  it("notifies when only the outline channel changes", () => {
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    const spans = channels();
    overrides.set(spans[FILL]!, "rgb(0, 0, 1)");
    r.resolve({ outline: "#d00" });
    overrides.set(spans[OUTLINE]!, "rgb(4, 4, 4)");
    fire(spans[OUTLINE]!);
    expect(calls).toBe(1);
    expect(r.resolve({ outline: "#d00" }).outline).toBe("rgb(4, 4, 4)");
  });

  it("returns the cache for a fresh-but-equal theme object", () => {
    const r = createMapThemeResolver(container, () => {});
    const a = r.resolve({ fill: "#a00" });
    const reads = gcs.mock.calls.length;
    const b = r.resolve({ fill: "#a00" });
    expect(b).toBe(a);
    expect(gcs.mock.calls.length).toBe(reads);
    expect(r.resolve({})).not.toBe(a);
  });

  it("treats undefined and empty themes as the same defaults", () => {
    const r = createMapThemeResolver(container, () => {});
    overrides.set(channels()[FILL]!, "rgb(0, 0, 1)");
    const a = r.resolve(undefined);
    expect(r.resolve({})).toBe(a);
  });

  it("substitutes constants while computed styles are unreadable", () => {
    const r = createMapThemeResolver(container, () => {});
    // happy-dom rejects the var() defaults, so the fill canary reads empty
    const t = r.resolve(undefined);
    expect(t.fill).toBe(LIGHT_FILL);
    expect(t.stroke).toBe(LIGHT_STROKE);
    expect(t.highlight).toBe(LIGHT_HIGHLIGHT);
    expect(r.unresolved()).toBe(true);
    overrides.set(channels()[FILL]!, "rgb(1, 1, 1)");
    expect(r.resolve(undefined).fill).toBe("rgb(1, 1, 1)");
    expect(r.unresolved()).toBe(false);
  });

  it("passes plain theme colors through while unreadable", () => {
    const r = createMapThemeResolver(container, () => {});
    gcs.mockImplementation(() => ({ color: "" }) as CSSStyleDeclaration);
    const t = r.resolve({
      fill: "#eee",
      stroke: "#111",
      outline: "#0a0",
      background: "var(--x)",
    });
    expect(t.fill).toBe("#eee");
    expect(t.stroke).toBe("#111");
    expect(t.borders).toBe("#111");
    expect(t.outline).toBe("#0a0");
    expect(t.background).toBeUndefined();
    expect(r.unresolved()).toBe(true);
  });

  it("retries palettes while computed styles are unreadable", () => {
    const r = createMapThemeResolver(container, () => {});
    gcs.mockImplementation(() => ({ color: "" }) as CSSStyleDeclaration);
    expect(r.resolvePalette(["#111"], ["#f0f0f0"])).toEqual(["#f0f0f0"]);
    gcs.mockImplementation(
      (el: unknown) =>
        ({
          color:
            overrides.get(el as Element) ?? (el as HTMLElement).style.color,
        }) as CSSStyleDeclaration,
    );
    expect(r.resolvePalette(["#111"], ["#f0f0f0"])).toEqual(["#111"]);
  });

  it("notifies exactly once when resolved colors change", () => {
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    const [fillEl] = channels();
    fire(fillEl!); // before first resolve: inert
    expect(calls).toBe(0);
    r.resolve({ fill: "#a00", stroke: "#0b0" });
    fire(fillEl!); // computed colors unchanged: no notify
    expect(calls).toBe(0);
    overrides.set(fillEl!, "rgb(9, 9, 9)");
    fire(fillEl!);
    expect(calls).toBe(1);
    expect(r.resolve({ fill: "#a00", stroke: "#0b0" }).fill).toBe(
      "rgb(9, 9, 9)",
    );
    fire(fillEl!); // matches the updated cache: no second notify
    expect(calls).toBe(1);
  });

  it("re-resolves when the caller mutates the same theme object in place", () => {
    const r = createMapThemeResolver(container, () => {});
    const [fillEl] = channels();
    overrides.set(fillEl!, "rgb(1, 1, 1)");
    const theme = { fill: "#a00" };
    expect(r.resolve(theme).fill).toBe("rgb(1, 1, 1)");
    // A reactive parent mutates the object it already passed; the cache
    // must not compare the object against itself.
    theme.fill = "#0b0";
    overrides.set(fillEl!, "rgb(2, 2, 2)");
    expect(r.resolve(theme).fill).toBe("rgb(2, 2, 2)");
  });

  it("recheck picks up changes missed while the map was hidden", () => {
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    const [fillEl] = channels();
    overrides.set(fillEl!, "rgb(1, 1, 1)");
    r.resolve({ fill: "#a00" });
    // No transition fires in a display:none subtree; the flip happens
    // unobserved and recheck() is the catch-up path.
    overrides.set(fillEl!, "rgb(9, 9, 9)");
    r.recheck();
    expect(calls).toBe(1);
    expect(r.resolve({ fill: "#a00" }).fill).toBe("rgb(9, 9, 9)");
    r.recheck(); // matches the cache: no second notify
    expect(calls).toBe(1);
  });

  it("invalidate forces a re-read on the next resolve", () => {
    const r = createMapThemeResolver(container, () => {});
    const [fillEl] = channels();
    r.resolve({ fill: "#a00" });
    overrides.set(fillEl!, "rgb(5, 5, 5)");
    expect(r.resolve({ fill: "#a00" }).fill).toBe("#a00");
    r.invalidate();
    expect(r.resolve({ fill: "#a00" }).fill).toBe("rgb(5, 5, 5)");
  });

  it("treats a parse-rejected background as absent", () => {
    const r = createMapThemeResolver(container, () => {});
    expect(r.resolve({ background: "not-a-color" }).background).toBeUndefined();
  });

  it("falls back when an invalid color follows a valid one", () => {
    const r = createMapThemeResolver(container, () => {});
    r.resolve({ fill: "#a00", background: "#00c" });
    const t = r.resolve({ fill: "not-a-color", background: "not-a-color" });
    expect(t.fill).not.toBe("#a00");
    expect(t.fill).not.toBe("not-a-color");
    expect(t.background).toBeUndefined();
  });

  it("never leaks raw unparseable strings to the canvas", () => {
    const r = createMapThemeResolver(container, () => {});
    expect(r.resolve({ fill: "not-a-color" }).fill).not.toBe("not-a-color");
  });

  it("gates adaptive defaults on light-dark() support", () => {
    const sup = vi.fn().mockReturnValue(false);
    vi.stubGlobal("CSS", { supports: sup });
    createMapThemeResolver(container, () => {});
    expect(sup).toHaveBeenCalledWith("color", "light-dark(#fff, #000)");
    expect(mapThemeDefaults.fill).toContain("var(--choropleth-fill");
    expect(mapThemeDefaults.fill).toContain("light-dark(");
    expect(mapThemeDefaults.stroke).toContain("var(--choropleth-stroke");
    expect(mapThemeDefaults.highlight).toContain("var(--choropleth-highlight");
  });

  it("rechecks on prefers-color-scheme changes", () => {
    let listener: (() => void) | null = null;
    vi.spyOn(window, "matchMedia").mockImplementation(
      (q: string) =>
        ({
          matches: false,
          media: q,
          addEventListener: (_: string, cb: () => void) => {
            listener = cb;
          },
          removeEventListener: () => {
            listener = null;
          },
        }) as unknown as MediaQueryList,
    );
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    const [fillEl] = channels();
    r.resolve({ fill: "#a00" });
    overrides.set(fillEl!, "rgb(7, 7, 7)");
    listener!();
    expect(calls).toBe(1);
    r.destroy();
    expect(listener).toBeNull();
  });

  it("resolves palettes through persistent watched swatches", () => {
    const r = createMapThemeResolver(container, () => {});
    expect(container.querySelectorAll("[data-cfasim-map-swatch]")).toHaveLength(
      0,
    );
    const resolved = r.resolvePalette(["#111", "#222"], ["#f1", "#f2"]);
    const spans = container.querySelectorAll<HTMLElement>(
      "[data-cfasim-map-swatch]",
    );
    expect(spans).toHaveLength(2);
    expect(channels()).toHaveLength(CHANNELS + 2);
    for (const s of Array.from(spans)) {
      expect(s.style.getPropertyValue("transition")).toContain("step-start");
      expect(s.style.getPropertyPriority("transition")).toBe("important");
    }
    expect(resolved).toEqual(["#111", "#222"]);
  });

  it("caches palettes by content with stable identity", () => {
    const r = createMapThemeResolver(container, () => {});
    const a = r.resolvePalette(["#111", "#222"], []);
    const reads = gcs.mock.calls.length;
    expect(r.resolvePalette(["#111", "#222"], [])).toBe(a);
    expect(gcs.mock.calls.length).toBe(reads);
    const c = r.resolvePalette(["#111", "#333"], []);
    expect(c).not.toBe(a);
    expect(c).toEqual(["#111", "#333"]);
  });

  it("grows the swatch pool without shrinking", () => {
    const r = createMapThemeResolver(container, () => {});
    r.resolvePalette(["#111", "#222", "#333"], []);
    r.resolvePalette(["#444"], []);
    expect(container.querySelectorAll("[data-cfasim-map-swatch]")).toHaveLength(
      3,
    );
    expect(r.resolvePalette(["#444"], [])).toEqual(["#444"]);
  });

  it("notifies once when a swatch resolves differently", () => {
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    overrides.set(channels()[FILL]!, "rgb(0, 0, 1)");
    r.resolvePalette(["#111", "#222"], []);
    const swatch = container.querySelector<HTMLElement>(
      "[data-cfasim-map-swatch='0']",
    )!;
    fire(swatch);
    expect(calls).toBe(0);
    overrides.set(swatch, "rgb(9, 9, 9)");
    fire(swatch);
    expect(calls).toBe(1);
    expect(r.resolvePalette(["#111", "#222"], [])).toEqual([
      "rgb(9, 9, 9)",
      "#222",
    ]);
    fire(swatch);
    expect(calls).toBe(1);
  });

  it("ignores stale tail swatches after the pool shrinks its active prefix", () => {
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    overrides.set(channels()[FILL]!, "rgb(0, 0, 1)");
    r.resolvePalette(["#111", "#222", "#333"], []);
    r.resolvePalette(["#111"], []);
    const tail = container.querySelector<HTMLElement>(
      "[data-cfasim-map-swatch='2']",
    )!;
    overrides.set(tail, "rgb(9, 9, 9)");
    fire(tail);
    expect(calls).toBe(0);
  });

  it("notifies once when a theme channel and a swatch change together", () => {
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    const [fillEl] = channels();
    r.resolve({ fill: "#a00" });
    r.resolvePalette(["#111"], []);
    overrides.set(fillEl!, "rgb(8, 8, 8)");
    const swatch = container.querySelector<HTMLElement>(
      "[data-cfasim-map-swatch='0']",
    )!;
    overrides.set(swatch, "rgb(9, 9, 9)");
    fire(swatch);
    expect(calls).toBe(1);
    expect(r.resolve({ fill: "#a00" }).fill).toBe("rgb(8, 8, 8)");
    expect(r.resolvePalette(["#111"], [])).toEqual(["rgb(9, 9, 9)"]);
  });

  it("falls back per swatch entry when a color is parse-rejected", () => {
    const r = createMapThemeResolver(container, () => {});
    const resolved = r.resolvePalette(["not-a-color"], ["#f0f0f0"]);
    expect(resolved[0]).not.toBe("not-a-color");
  });

  it("invalidate forces a palette re-read", () => {
    const r = createMapThemeResolver(container, () => {});
    r.resolvePalette(["#111"], []);
    const swatch = container.querySelector<HTMLElement>(
      "[data-cfasim-map-swatch='0']",
    )!;
    overrides.set(swatch, "rgb(5, 5, 5)");
    expect(r.resolvePalette(["#111"], [])).toEqual(["#111"]);
    r.invalidate();
    expect(r.resolvePalette(["#111"], [])).toEqual(["rgb(5, 5, 5)"]);
  });

  it("destroy removes swatches with the probe", () => {
    const r = createMapThemeResolver(container, () => {});
    r.resolvePalette(["#111"], []);
    r.destroy();
    expect(container.querySelectorAll("[data-cfasim-map-swatch]")).toHaveLength(
      0,
    );
  });

  it("keeps probe transition events out of the container", () => {
    const seen = vi.fn();
    container.addEventListener("transitionstart", seen);
    createMapThemeResolver(container, () => {});
    fire(channels()[FILL]!);
    expect(seen).not.toHaveBeenCalled();
  });

  it("destroy removes the probe and inerts events", () => {
    let calls = 0;
    const r = createMapThemeResolver(container, () => calls++);
    const [fillEl] = channels();
    r.resolve({ fill: "#a00" });
    r.destroy();
    expect(container.querySelector("[data-cfasim-map-probe]")).toBeNull();
    overrides.set(fillEl!, "rgb(9, 9, 9)");
    fire(fillEl!);
    expect(calls).toBe(0);
  });
});
