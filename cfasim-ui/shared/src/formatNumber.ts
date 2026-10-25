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
  "plain" | "localized" | "percent" | "compact" | "scientific" | "engineering";

/**
 * A number format specifier:
 * - A {@link NumberFormatPreset} name, optionally with `:N` digits suffix
 *   (e.g. `"percent:1"`, `"compact:2"`)
 * - A printf-style format string (must contain a `%` placeholder, see
 *   {@link formatPrintf}: e.g. `"%.2f"`, `"%05d"`)
 * - A function `(value) => string` for full control
 *
 * Strings that contain no `%` and don't match a preset throw at format
 * time, so typos surface immediately instead of silently rendering wrong.
 */
export type NumberFormat =
  NumberFormatPreset | string | ((value: number) => string);

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

const PRINTF_SPEC = /^%([-+ 0]*)(\d+)?(?:\.(\d+))?([a-zA-Z%])/;

/**
 * Substitute `value` into every placeholder of a printf-style string.
 *
 * Supported: `%[flags][width][.precision]type` with flags `-` (left-align),
 * `+` (always sign), ` ` (space for positive), `0` (zero-pad); types `d`/`i`
 * (truncate to integer), `f` (fixed; raw value without a precision), `e`/`E`
 * (exponential), `g` (`toPrecision`), `s` (`String`, precision truncates),
 * and `%%` for a literal percent sign. A `%` that does not start one of
 * these, or any other conversion letter, throws, as sprintf-js did; this
 * replaced sprintf-js and prints the same as it did for every supported
 * conversion, except that `%d` of a negative fraction is `0` rather than
 * sprintf-js's `-0`.
 */
export function formatPrintf(format: string, value: number): string {
  let out = "";
  let i = 0;
  while (i < format.length) {
    const at = format.indexOf("%", i);
    if (at === -1) {
      out += format.slice(i);
      break;
    }
    out += format.slice(i, at);
    const match = PRINTF_SPEC.exec(format.slice(at));
    if (!match) {
      throw new Error(
        `formatNumber: malformed printf placeholder at index ${at} in ${JSON.stringify(format)}`,
      );
    }
    const [spec, flags, width, precision, type] = match;
    out += formatPlaceholder(format, value, flags, width, precision, type);
    i = at + spec.length;
  }
  return out;
}

function formatPlaceholder(
  format: string,
  value: number,
  flags: string,
  width: string | undefined,
  precision: string | undefined,
  type: string,
): string {
  if (type === "%") return "%";
  const p = precision === undefined ? undefined : Number(precision);
  let abs = Math.abs(value);
  let body: string;
  switch (type) {
    case "d":
    case "i":
      abs = Math.trunc(abs);
      body = String(abs);
      break;
    case "f":
      body = p === undefined ? String(abs) : abs.toFixed(p);
      break;
    case "e":
    case "E":
      body = p === undefined ? abs.toExponential() : abs.toExponential(p);
      if (type === "E") body = body.toUpperCase();
      break;
    case "g":
      body = p === undefined ? String(abs) : String(Number(abs.toPrecision(p)));
      break;
    case "s":
      body = String(value);
      if (p !== undefined) body = body.slice(0, p);
      break;
    default:
      throw new Error(
        `formatNumber: unsupported printf conversion "%${type}" in ${JSON.stringify(format)}`,
      );
  }
  const numeric = type !== "s";
  // `%d` of -0.4 is 0, not -0: the sign follows the truncated value.
  const negative = numeric && value < 0 && abs !== 0;
  const sign = !numeric
    ? ""
    : negative
      ? "-"
      : flags.includes("+")
        ? "+"
        : flags.includes(" ")
          ? " "
          : "";
  const w = width === undefined ? 0 : Number(width);
  const pad = w - sign.length - body.length;
  if (pad <= 0) return sign + body;
  if (flags.includes("-")) return sign + body + " ".repeat(pad);
  if (flags.includes("0")) return sign + "0".repeat(pad) + body;
  return " ".repeat(pad) + sign + body;
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
  if (format.includes("%")) return formatPrintf(format, value);
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
