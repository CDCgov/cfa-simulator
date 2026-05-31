/**
 * Color helpers for picking a readable text color against a bar fill.
 * The luminance math is pure and unit-testable; resolving CSS values
 * that aren't plain hex/rgb (named colors, `var(--x)`) needs the DOM and
 * is handled separately by {@link resolveColorToRgb}.
 */

export type Rgb = [number, number, number];

/**
 * Parse a hex (`#rgb`, `#rrggbb`, `#rrggbbaa`) or `rgb()/rgba()` string to
 * `[r, g, b]` in 0..255. Returns null for anything else (named colors,
 * `var(...)`, `hsl(...)`) — resolve those via {@link resolveColorToRgb}.
 */
export function parseRgb(color: string): Rgb | null {
  const c = color.trim();
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split("")
        .map((ch) => ch + ch)
        .join("");
    } else if (hex.length === 6 || hex.length === 8) {
      hex = hex.slice(0, 6);
    } else {
      return null;
    }
    const n = Number.parseInt(hex, 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const rgb = parts.slice(0, 3).map((p) => {
      if (p.endsWith("%")) return Math.round((parseFloat(p) / 100) * 255);
      return Math.round(parseFloat(p));
    });
    if (rgb.some((v) => Number.isNaN(v))) return null;
    return [rgb[0], rgb[1], rgb[2]];
  }
  return null;
}

/** WCAG relative luminance (0 = black, 1 = white) for an RGB triple. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

let probe: HTMLSpanElement | null = null;
const resolveCache = new Map<string, Rgb | null>();

/**
 * Resolve any CSS color string (including named colors and `var(--x)`) to
 * an RGB triple by letting the browser compute it on a hidden probe
 * element. Cached per input. Returns null in non-DOM environments or when
 * the value can't be resolved. Plain hex/rgb shortcut through
 * {@link parseRgb} without touching the DOM.
 */
export function resolveColorToRgb(color: string): Rgb | null {
  const direct = parseRgb(color);
  if (direct) return direct;
  if (resolveCache.has(color)) return resolveCache.get(color) ?? null;
  if (typeof document === "undefined") return null;
  if (!probe) {
    probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  probe.style.color = "";
  probe.style.color = color;
  const computed = getComputedStyle(probe).color;
  const rgb = parseRgb(computed);
  resolveCache.set(color, rgb);
  return rgb;
}

/**
 * Pick the more readable of `light`/`dark` text colors for a given fill.
 * Uses the WCAG luminance threshold (0.179) that maximizes contrast
 * against black-or-white text. When the fill can't be resolved (e.g. an
 * unresolvable CSS var in a non-DOM context), falls back to `light`.
 */
export function pickContrastColor(
  fill: string,
  light = "#ffffff",
  dark = "#1a1a1a",
): string {
  const rgb = resolveColorToRgb(fill);
  if (!rgb) return light;
  return relativeLuminance(rgb) > 0.179 ? dark : light;
}
