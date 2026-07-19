/**
 * Map theming. All paint styling for the choropleth surface lives in one
 * `MapTheme` object: base fill, interior strokes, the state-borders mesh,
 * an exterior outline, a background wash, and the hover/focus highlight.
 *
 * Every color accepts any CSS color the page can express (`var()`,
 * `light-dark()`, `currentColor`, `color-mix()`), resolved against the map
 * container's cascade by a hidden probe. Defaults route through
 * `--choropleth-*` custom properties with `light-dark()` fallbacks, so a
 * stylesheet alone can theme every map on a page; JS theme values win.
 * When the effective values change (a class flip up the tree, an OS
 * scheme change, a custom-property redefinition), the resolver notifies
 * so the map can repaint. Ported from pleth's theme resolver.
 */
import { computed, onMounted, onUnmounted, ref, type Ref } from "vue";
import { parseRgb } from "./contrast.js";

export interface MapTheme {
  /**
   * Base fill for features without a data value (any CSS color).
   * Default: `var(--choropleth-fill, light-dark(#ddd, #3f3f46))`.
   */
  fill?: string;
  /**
   * Interior feature borders (any CSS color).
   * Default: `var(--choropleth-stroke, light-dark(#fff, #18181b))`.
   */
  stroke?: string;
  /**
   * Feature border width in CSS px, kept constant on screen at any zoom.
   * Unset falls back to the component default (0.5, halved on county/HSA
   * maps); an explicit value applies as-is on every geoType. 0 disables.
   */
  strokeWidth?: number;
  /**
   * The state-boundary mesh drawn over county/HSA maps. Falls back to
   * `stroke` unless a visible color resolves (from here or the
   * `--choropleth-borders` custom property). Hide it with
   * `bordersWidth: 0`.
   */
  borders?: string;
  /** State-borders mesh width in CSS px. Default 1; 0 disables. */
  bordersWidth?: number;
  /**
   * Exterior boundary of the rendered geography (the nation outline, or
   * the state outline in single-state mode), drawn on top of interior
   * borders. Off unless a visible color resolves, so the
   * `--choropleth-outline` custom property can enable it (it defaults to
   * `transparent`).
   */
  outline?: string;
  /** Exterior outline width in CSS px. Default 1; 0 disables. */
  outlineWidth?: number;
  /**
   * Background wash behind the map features. Off unless a visible color
   * resolves, so the `--choropleth-background` custom property can enable
   * it (it defaults to `transparent`).
   */
  background?: string;
  /**
   * Hover/focus highlight stroke. Default:
   * `var(--choropleth-highlight, light-dark(#000, #fff))`. Per-item
   * `FocusItem.stroke` still wins for individual focus outlines.
   */
  highlight?: string;
  /**
   * Marker overlay (the `cities` prop layer): dot and label color (any
   * CSS color). Sets both `--choropleth-city-marker` and
   * `--choropleth-city-label-color`; default `#1a1a1a` (dark markers
   * with a thin white halo read over any fill in either scheme). The
   * marker layer is SVG in both renderers, so these four keys resolve
   * in CSS directly (no probe) and follow theme flips on their own.
   */
  markerColor?: string;
  /**
   * Marker overlay: halo color around dots and labels (sets
   * `--choropleth-city-halo`). Default `#fff`.
   */
  markerHalo?: string;
  /**
   * Halo width around each marker dot, in CSS px (constant on screen at
   * any zoom). Default 0.9; 0 disables the dot halo. The label halo is
   * unaffected.
   */
  markerHaloWidth?: number;
  /** Opacity of the whole marker layer (dots, labels, halos). Default 1. */
  markerOpacity?: number;
}

/** Theme values resolved to canvas-paintable colors. */
export interface ResolvedMapTheme {
  fill: string;
  stroke: string;
  strokeWidth: number | undefined;
  /** Resolved borders color, falling back to `stroke`. */
  borders: string;
  bordersWidth: number | undefined;
  /** undefined when the outline resolves invisible (off by default) */
  outline: string | undefined;
  outlineWidth: number | undefined;
  /** undefined when the background resolves invisible (off by default) */
  background: string | undefined;
  highlight: string;
}

export const LIGHT_FILL = "#ddd";
export const DARK_FILL = "#3f3f46";
export const LIGHT_STROKE = "#fff";
export const DARK_STROKE = "#18181b";
export const LIGHT_HIGHLIGHT = "#000";
export const DARK_HIGHLIGHT = "#fff";

/**
 * The built-in defaults: every channel routes through a `--choropleth-*`
 * custom property, so CSS alone can retheme maps. `borders`, `outline`,
 * and `background` use `transparent` sentinels, staying off (or, for
 * borders, deferring to `stroke`) until a visible color resolves.
 */
export const mapThemeDefaults = {
  fill: `var(--choropleth-fill, light-dark(${LIGHT_FILL}, ${DARK_FILL}))`,
  stroke: `var(--choropleth-stroke, light-dark(${LIGHT_STROKE}, ${DARK_STROKE}))`,
  borders: "var(--choropleth-borders, transparent)",
  outline: "var(--choropleth-outline, transparent)",
  background: "var(--choropleth-background, transparent)",
  highlight: `var(--choropleth-highlight, light-dark(${LIGHT_HIGHLIGHT}, ${DARK_HIGHLIGHT}))`,
} as const;

/** Shallow per-key equality; undefined and {} compare equal. */
export function themeEquals(
  a: MapTheme | undefined,
  b: MapTheme | undefined,
): boolean {
  return (
    Object.is(a?.fill, b?.fill) &&
    Object.is(a?.stroke, b?.stroke) &&
    Object.is(a?.strokeWidth, b?.strokeWidth) &&
    Object.is(a?.borders, b?.borders) &&
    Object.is(a?.bordersWidth, b?.bordersWidth) &&
    Object.is(a?.outline, b?.outline) &&
    Object.is(a?.outlineWidth, b?.outlineWidth) &&
    Object.is(a?.background, b?.background) &&
    Object.is(a?.highlight, b?.highlight) &&
    Object.is(a?.markerColor, b?.markerColor) &&
    Object.is(a?.markerHalo, b?.markerHalo) &&
    Object.is(a?.markerHaloWidth, b?.markerHaloWidth) &&
    Object.is(a?.markerOpacity, b?.markerOpacity)
  );
}

// zero-alpha in any computed serialization: the legacy comma forms put
// alpha as the 4th rgba()/hsla() argument, modern forms after a slash
const ALPHA_ZERO =
  /^(?:rgba|hsla)\(.*,\s*0(?:\.0+)?\s*\)$|\/\s*0(?:\.0+)?\s*\)$/;

/** A resolved color that should actually paint; transparent means "off". */
export const visible = (c: string): string | undefined =>
  c && c !== "transparent" && !ALPHA_ZERO.test(c) ? c : undefined;

/**
 * Raw-value passthrough for environments without computed styles (test
 * DOMs, containers with no layout): a theme value that already parses as
 * a plain color paints as-is instead of dropping to the constants.
 */
const plain = (c: string | undefined): string | undefined =>
  c && parseRgb(c) ? c : undefined;

/**
 * Bare var() parses but is invalid at computed-value time when the property
 * is undefined, inheriting the page text color; give it a fallback instead.
 * var() references that already carry a fallback are left alone.
 */
export function withVarFallback(value: string, fallback: string): string {
  return value.replace(/var\((\s*--[\w-]+\s*)\)/g, `var($1, ${fallback})`);
}

export interface MapThemeResolver {
  resolve(theme: MapTheme | undefined): ResolvedMapTheme;
  /**
   * Resolve scale palette colors (colorScale endpoints and stop colors)
   * through the cascade. Each entry gets a persistent watched span, so env
   * changes to any entry notify. Returns a stable array identity until an
   * entry actually resolves differently.
   */
  resolvePalette(
    colors: readonly string[],
    fallbacks: readonly string[],
  ): readonly string[];
  /** Force a re-read on the next resolve (env may have changed unobserved) */
  invalidate(): void;
  /**
   * Compare probe reads against the cache and notify if anything changed.
   * Transitions don't run in non-rendered subtrees, so a map hidden with
   * `display:none` misses theme flips; call this when it may have been
   * shown again (cheap: a handful of getComputedStyle reads, bail on equal).
   */
  recheck(): void;
  /** True while the last resolve/palette read fell back to constants. */
  unresolved(): boolean;
  destroy(): void;
}

/**
 * Hidden probe that resolves CSS color strings against the container's
 * cascade, one channel span per themed color. Each span carries a
 * step-start color transition, so any change to a resolved color (class
 * flip up the tree, media query flip, var redefinition) fires a transition
 * event and triggers `onEnvChange`.
 */
export function createMapThemeResolver(
  container: HTMLElement,
  onEnvChange: () => void,
): MapThemeResolver {
  const doc = container.ownerDocument;
  const win = doc.defaultView!;
  // light-dark() invalid at computed-value time behaves as unset and
  // inherits the page text color, so gate the adaptive defaults
  const adaptive =
    typeof win.CSS?.supports === "function" &&
    win.CSS.supports("color", "light-dark(#fff, #000)");
  const defaults = {
    fill: adaptive
      ? mapThemeDefaults.fill
      : `var(--choropleth-fill, ${LIGHT_FILL})`,
    stroke: adaptive
      ? mapThemeDefaults.stroke
      : `var(--choropleth-stroke, ${LIGHT_STROKE})`,
    highlight: adaptive
      ? mapThemeDefaults.highlight
      : `var(--choropleth-highlight, ${LIGHT_HIGHLIGHT})`,
    // transparent sentinels: these stay off until a visible color resolves
    borders: mapThemeDefaults.borders,
    outline: mapThemeDefaults.outline,
    background: mapThemeDefaults.background,
  };

  const probe = doc.createElement("div");
  probe.dataset.cfasimMapProbe = "1";
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;width:0;height:0;overflow:hidden;" +
    "visibility:hidden;pointer-events:none";
  const channel = () => {
    const el = doc.createElement("span");
    // inline importance so `* { transition: none !important }` resets cannot
    // disable detection; step-start so a synchronous read in the event
    // handler sees the final color, never an interpolated blend
    el.style.setProperty("transition", "color 1ms step-start", "important");
    probe.appendChild(el);
    return el;
  };
  const fillEl = channel();
  const strokeEl = channel();
  const bordersEl = channel();
  const outlineEl = channel();
  const bgEl = channel();
  const highlightEl = channel();
  container.appendChild(probe);

  let fresh = false;
  let last: MapTheme | undefined;
  let rawBorders = "";
  let rawOutline = "";
  let rawBackground = "";
  // swatch pool for scale palettes: grows to the largest palette seen,
  // never shrinks; swatchCount marks the active prefix
  const swatches: HTMLElement[] = [];
  let swatchCount = 0;
  let paletteFresh = false;
  let lastPaletteInput: readonly string[] = [];
  let rawPalette: string[] = [];
  let cachedPalette: readonly string[] = [];
  let cached: ResolvedMapTheme = {
    fill: LIGHT_FILL,
    stroke: LIGHT_STROKE,
    strokeWidth: undefined,
    borders: LIGHT_STROKE,
    bordersWidth: undefined,
    outline: undefined,
    outlineWidth: undefined,
    background: undefined,
    highlight: LIGHT_HIGHLIGHT,
  };

  // parse-rejected values leave style.color empty and would silently
  // resolve to the inherited text color; fall back instead. The reset
  // matters: CSSOM keeps the previous value on an invalid assignment,
  // which would defeat the emptiness check on rewrites.
  function write(el: HTMLElement, value: string, fallback: string) {
    // var()-wrapped light-dark() (like the defaults) parses everywhere
    // but is invalid at computed-value time on unsupporting browsers and
    // would inherit the page text color; degrade before writing
    if (!adaptive && value.includes("light-dark(")) value = fallback;
    el.style.color = "";
    el.style.color = withVarFallback(value, fallback);
    if (value && el.style.color === "") el.style.color = fallback;
  }

  const read = (el: HTMLElement) => win.getComputedStyle(el).color;

  function widthsFrom(theme: MapTheme | undefined) {
    return {
      strokeWidth: theme?.strokeWidth,
      bordersWidth: theme?.bordersWidth,
      outlineWidth: theme?.outlineWidth,
    };
  }

  function resolve(theme: MapTheme | undefined): ResolvedMapTheme {
    if (fresh && themeEquals(theme, last)) return cached;
    // Shallow copy: callers may mutate a reactive theme object in place,
    // and storing the reference would make themeEquals compare it against
    // itself forever.
    last = theme && { ...theme };
    // || rather than ??: empty strings mean unset, not "inherit text color"
    write(fillEl, theme?.fill || defaults.fill, defaults.fill);
    write(strokeEl, theme?.stroke || defaults.stroke, defaults.stroke);
    write(bordersEl, theme?.borders || defaults.borders, defaults.borders);
    write(outlineEl, theme?.outline || defaults.outline, defaults.outline);
    write(bgEl, theme?.background || defaults.background, defaults.background);
    write(
      highlightEl,
      theme?.highlight || defaults.highlight,
      defaults.highlight,
    );
    const fillColor = read(fillEl);
    if (fillColor === "") {
      // unrendered or disconnected container: computed styles are
      // unavailable, so paint plain theme colors (or constants) now and
      // retry on the next resolve
      fresh = false;
      const stroke = plain(theme?.stroke) ?? LIGHT_STROKE;
      cached = {
        fill: plain(theme?.fill) ?? LIGHT_FILL,
        stroke,
        borders: plain(theme?.borders) ?? stroke,
        outline: plain(theme?.outline),
        background: plain(theme?.background),
        highlight: plain(theme?.highlight) ?? LIGHT_HIGHLIGHT,
        ...widthsFrom(theme),
      };
      return cached;
    }
    const stroke = read(strokeEl);
    rawBorders = read(bordersEl);
    rawOutline = read(outlineEl);
    rawBackground = read(bgEl);
    cached = {
      fill: fillColor,
      stroke,
      borders: visible(rawBorders) ?? stroke,
      outline: visible(rawOutline),
      background: visible(rawBackground),
      highlight: read(highlightEl),
      ...widthsFrom(theme),
    };
    fresh = true;
    return cached;
  }

  function resolvePalette(
    colors: readonly string[],
    fallbacks: readonly string[],
  ): readonly string[] {
    if (
      paletteFresh &&
      colors.length === lastPaletteInput.length &&
      colors.every((c, i) => c === lastPaletteInput[i])
    ) {
      return cachedPalette;
    }
    lastPaletteInput = [...colors];
    while (swatches.length < colors.length) {
      const el = channel();
      el.dataset.cfasimMapSwatch = String(swatches.length);
      swatches.push(el);
    }
    swatchCount = colors.length;
    for (let i = 0; i < swatchCount; i++) {
      write(swatches[i]!, colors[i]!, fallbacks[i] ?? "");
    }
    rawPalette = swatches.slice(0, swatchCount).map(read);
    if (rawPalette.includes("")) {
      // unreadable entries (unrendered container): substitute the
      // fallbacks and retry on the next resolve
      paletteFresh = false;
      cachedPalette = rawPalette.map((c, i) => c || fallbacks[i] || "");
      return cachedPalette;
    }
    cachedPalette = [...rawPalette];
    paletteFresh = true;
    return cachedPalette;
  }

  // transition writes fire this too; the compare-and-bail keeps a
  // prop-driven resolve from scheduling a second repaint
  function recheck() {
    const fillColor = read(fillEl);
    if (fillColor === "") return; // unrendered: reads are meaningless
    let changed = false;
    if (fresh) {
      const stroke = read(strokeEl);
      const borders = read(bordersEl);
      const outline = read(outlineEl);
      const background = read(bgEl);
      const highlight = read(highlightEl);
      if (
        fillColor !== cached.fill ||
        stroke !== cached.stroke ||
        borders !== rawBorders ||
        outline !== rawOutline ||
        background !== rawBackground ||
        highlight !== cached.highlight
      ) {
        rawBorders = borders;
        rawOutline = outline;
        rawBackground = background;
        cached = {
          ...cached,
          fill: fillColor,
          stroke,
          borders: visible(borders) ?? stroke,
          outline: visible(outline),
          background: visible(background),
          highlight,
        };
        changed = true;
      }
    }
    if (paletteFresh && swatchCount) {
      let paletteChanged = false;
      for (let i = 0; i < swatchCount; i++) {
        const c = read(swatches[i]!);
        if (c !== rawPalette[i]) {
          rawPalette[i] = c;
          paletteChanged = true;
        }
      }
      if (paletteChanged) {
        // new identity signals downstream scale memos to rebuild
        cachedPalette = [...rawPalette];
        changed = true;
      }
    }
    if (changed) onEnvChange();
  }

  // detection events are internal noise; keep them out of app listeners
  // on the container and its ancestors
  const onTransition = (e: Event) => {
    e.stopPropagation();
    recheck();
  };
  probe.addEventListener("transitionstart", onTransition);
  probe.addEventListener("transitionend", onTransition);
  // covers scheme flips while the probe has no box (hidden container)
  const mql = win.matchMedia
    ? win.matchMedia("(prefers-color-scheme: dark)")
    : null;
  mql?.addEventListener("change", recheck);

  return {
    resolve,
    resolvePalette,
    invalidate() {
      fresh = false;
      paletteFresh = false;
    },
    recheck,
    unresolved() {
      return !fresh;
    },
    destroy() {
      probe.removeEventListener("transitionstart", onTransition);
      probe.removeEventListener("transitionend", onTransition);
      mql?.removeEventListener("change", recheck);
      probe.remove();
    },
  };
}

/** Probe-free resolution for non-DOM environments and pre-mount reads. */
function resolveWithoutDom(theme: MapTheme | undefined): ResolvedMapTheme {
  const stroke = plain(theme?.stroke) ?? LIGHT_STROKE;
  return {
    fill: plain(theme?.fill) ?? LIGHT_FILL,
    stroke,
    strokeWidth: theme?.strokeWidth,
    borders: plain(theme?.borders) ?? stroke,
    bordersWidth: theme?.bordersWidth,
    outline: plain(theme?.outline),
    outlineWidth: theme?.outlineWidth,
    background: plain(theme?.background),
    highlight: plain(theme?.highlight) ?? LIGHT_HIGHLIGHT,
  };
}

/**
 * Vue wrapper around {@link createMapThemeResolver}: creates the probe in
 * `container` on mount, exposes the resolved theme as a computed, and bumps
 * an internal version (re-running dependents) whenever the environment
 * changes a resolved color. `resolvePalette` is reactive the same way; call
 * it from a computed so scale colors re-resolve on theme flips.
 */
export function useMapTheme(
  container: Ref<HTMLElement | null>,
  theme: () => MapTheme | undefined,
) {
  const version = ref(0);
  let resolver: MapThemeResolver | null = null;

  onMounted(() => {
    if (!container.value) return;
    resolver = createMapThemeResolver(container.value, () => {
      version.value++;
    });
    version.value++;
  });
  onUnmounted(() => {
    resolver?.destroy();
    resolver = null;
  });

  const resolved = computed<ResolvedMapTheme>(() => {
    void version.value;
    return resolver ? resolver.resolve(theme()) : resolveWithoutDom(theme());
  });

  function resolvePalette(
    colors: readonly string[],
    fallbacks: readonly string[],
  ): readonly string[] {
    void version.value;
    return resolver ? resolver.resolvePalette(colors, fallbacks) : [...colors];
  }

  /**
   * Re-sync with the environment when layout (re)appears. Covers two gaps
   * transition-based detection can't see: a resolve that fell back to
   * constants because the container had no layout (retry it), and a theme
   * flip that happened while the map sat in a `display:none` subtree,
   * where no transition ever fires (recheck reads vs cache and notifies
   * only on change).
   */
  function ensureResolved() {
    if (!resolver) return;
    if (resolver.unresolved()) version.value++;
    else resolver.recheck();
  }

  return { resolved, resolvePalette, ensureResolved };
}
