import type { Config } from "vega-lite";

/**
 * Builds a Vega {@link Config} from the app's resolved `--color-*` /
 * `--font-family` theme tokens so embedded Vega-Lite plots match the
 * surrounding UI in both light and dark mode.
 *
 * Vega can't read CSS variables, so we resolve each token to a concrete
 * color string via a hidden probe element and feed the results into the
 * config. The probe is read **fresh** on every call (no caching) because
 * the same token (e.g. `var(--color-text)`) resolves to different values
 * after a light/dark toggle — the shared `resolveColorToRgb` in
 * `_shared/contrast.ts` caches by input string and would return a stale
 * value here. Call this again and re-embed whenever the theme changes.
 */

let probe: HTMLSpanElement | null = null;

function getProbe(): HTMLSpanElement | null {
  if (typeof document === "undefined") return null;
  if (!probe) {
    probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  return probe;
}

/**
 * Resolve a CSS color value (including `var(--x)` and `light-dark(...)`)
 * to a concrete `rgb(...)` string using a hidden probe. The probe lives
 * under `<body>` so it sees the `:root` variables and inherits the active
 * `color-scheme`, making `light-dark()` resolve to the current theme.
 */
function resolveCssColor(value: string, fallback: string): string {
  const el = getProbe();
  if (!el) return fallback;
  el.style.color = "";
  el.style.color = value;
  const computed = getComputedStyle(el).color;
  return computed || fallback;
}

function resolveFont(value: string, fallback: string): string {
  const el = getProbe();
  if (!el) return fallback;
  el.style.fontFamily = "";
  el.style.fontFamily = value;
  const computed = getComputedStyle(el).fontFamily;
  return computed || fallback;
}

/**
 * Categorical palette for `range.category`. The first slot is the app's
 * `--color-primary`; the rest is the Observable10 set, which stays
 * legible on both light and dark backgrounds.
 */
const CATEGORY_PALETTE = [
  "#efb118",
  "#ff725c",
  "#6cc5b0",
  "#3ca951",
  "#ff8ab7",
  "#a463f2",
  "#97bbf5",
  "#9c6b4e",
  "#9498a0",
];

/**
 * Read the current theme tokens and return a Vega config. Must run in a
 * DOM context; returns an empty config (Vega defaults) on the server.
 */
export function buildVegaThemeConfig(): Config {
  if (typeof document === "undefined") return {};

  const text = resolveCssColor("var(--color-text)", "#212529");
  const secondary = resolveCssColor("var(--color-text-secondary)", "#495057");
  const border = resolveCssColor("var(--color-border)", "#dee2e6");
  const background = resolveCssColor("var(--color-bg-0)", "#ffffff");
  const primary = resolveCssColor("var(--color-primary)", "#0066ff");
  const font = resolveFont("var(--font-family)", "sans-serif");

  return {
    background,
    view: { stroke: "transparent" },
    title: {
      color: text,
      subtitleColor: secondary,
      font,
      subtitleFont: font,
    },
    axis: {
      domainColor: border,
      gridColor: border,
      tickColor: border,
      labelColor: secondary,
      titleColor: text,
      labelFont: font,
      titleFont: font,
    },
    legend: {
      labelColor: secondary,
      titleColor: text,
      labelFont: font,
      titleFont: font,
    },
    range: {
      category: [primary, ...CATEGORY_PALETTE],
    },
  };
}
