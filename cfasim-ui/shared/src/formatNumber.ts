import { sprintf } from "sprintf-js";

/**
 * Named number-format presets, modelled on Streamlit's number column formats.
 * - `plain` — `String(value)` (no grouping)
 * - `localized` — `Intl.NumberFormat()` with the user's locale
 * - `percent` — formats as a percent (value `0.5` → `"50%"`)
 * - `compact` — short form (`1.2K`, `3.4M`)
 * - `scientific` — scientific notation (`1.23E4`)
 * - `engineering` — engineering notation (powers of 1000)
 *
 * Presets preserve the raw value's precision by default (no rounding).
 * Append `:N` (a digit) to fix the number of fractional digits, e.g.
 * `"percent:1"` → `"12.3%"`, `"localized:2"` → `"1,234.50"`.
 */
export type NumberFormatPreset =
  | "plain"
  | "localized"
  | "percent"
  | "compact"
  | "scientific"
  | "engineering";

/**
 * A number format specifier:
 * - A {@link NumberFormatPreset} name, optionally with `:N` digits suffix
 *   (e.g. `"percent:1"`, `"compact:2"`)
 * - A printf-style format string (must contain a `%` placeholder, parsed
 *   by sprintf-js — e.g. `"%.2f"`, `"%05d"`)
 * - A function `(value) => string` for full control
 *
 * Strings that contain no `%` and don't match a preset throw at format
 * time, so typos surface immediately instead of silently rendering wrong.
 */
export type NumberFormat =
  | NumberFormatPreset
  | string
  | ((value: number) => string);

const PRESET_NAMES = new Set<NumberFormatPreset>([
  "plain",
  "localized",
  "percent",
  "compact",
  "scientific",
  "engineering",
]);

function isPreset(s: string): s is NumberFormatPreset {
  return PRESET_NAMES.has(s as NumberFormatPreset);
}

/**
 * Parse `"preset"` or `"preset:N"` into a name and optional digit count.
 * Returns null if the string isn't a recognized preset.
 */
function parsePreset(
  s: string,
): { preset: NumberFormatPreset; digits: number | undefined } | null {
  const colon = s.indexOf(":");
  if (colon === -1) {
    return isPreset(s) ? { preset: s, digits: undefined } : null;
  }
  const name = s.slice(0, colon);
  const rest = s.slice(colon + 1);
  if (!isPreset(name)) return null;
  // Digits must be a non-negative integer (matches Intl's 0..100 range).
  if (!/^\d+$/.test(rest)) return null;
  const digits = Number(rest);
  if (digits > 100) return null;
  return { preset: name, digits };
}

// Covers JS double-precision (≤17 significant digits). When the caller
// hasn't asked for a specific digit count, we use this to preserve the
// raw value rather than letting Intl round to its default precision.
const RAW_PRECISION_DIGITS = 20;

function formatPreset(
  value: number,
  preset: NumberFormatPreset,
  digits: number | undefined,
): string {
  const fractionOpts: Intl.NumberFormatOptions =
    digits !== undefined
      ? { minimumFractionDigits: digits, maximumFractionDigits: digits }
      : { maximumFractionDigits: RAW_PRECISION_DIGITS };
  switch (preset) {
    case "plain":
      return digits !== undefined ? value.toFixed(digits) : String(value);
    case "localized":
      return new Intl.NumberFormat(undefined, fractionOpts).format(value);
    case "percent":
      return new Intl.NumberFormat(undefined, {
        style: "percent",
        ...fractionOpts,
      }).format(value);
    case "compact":
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
        ...fractionOpts,
      }).format(value);
    case "scientific":
      return new Intl.NumberFormat(undefined, {
        notation: "scientific",
        ...fractionOpts,
      }).format(value);
    case "engineering":
      return new Intl.NumberFormat(undefined, {
        notation: "engineering",
        ...fractionOpts,
      }).format(value);
  }
}

/**
 * Format a number using a preset name, a printf-style format string, or a
 * custom function. Non-finite values (NaN, ±Infinity) are returned as
 * `String(value)`; if `format` is omitted, falls back to `String(value)`.
 *
 * Throws if `format` is a string that's neither a recognized preset (with
 * an optional `:N` digit suffix) nor a printf string containing `%`.
 */
export function formatNumber(value: number, format?: NumberFormat): string {
  if (!Number.isFinite(value)) return String(value);
  if (format === undefined) return String(value);
  if (typeof format === "function") return format(value);
  // printf strings always contain a `%` placeholder; everything else must
  // be a recognized preset (with an optional `:N` digits suffix).
  if (format.includes("%")) return sprintf(format, value);
  const parsed = parsePreset(format);
  if (!parsed) {
    const names = [...PRESET_NAMES].join(", ");
    throw new Error(
      `formatNumber: invalid format ${JSON.stringify(format)}. ` +
        `Expected one of ${names} (optionally with ":N" digits), ` +
        `a printf format string containing "%", or a function.`,
    );
  }
  return formatPreset(value, parsed.preset, parsed.digits);
}

/** True if `f` is a recognized {@link NumberFormat} value. */
export function isNumberFormat(f: unknown): f is NumberFormat {
  return typeof f === "string" || typeof f === "function";
}
