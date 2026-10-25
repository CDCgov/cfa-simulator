/**
 * A number formatter from a d3-format specifier, the grammar Vega-Lite,
 * Observable and Altair use for `format`:
 * `[[fill]align][sign][symbol][0][width][,][.precision][~][type]`.
 * Output matches d3-format's default (en-US) locale, including its
 * typographic minus sign (`−`, U+2212). Pass the result anywhere a
 * `NumberFormat` is accepted, e.g. `yTickFormat: d3Format(".1%")`.
 *
 * Types: `e f g r s % p b o d x X c n`, and none (`.12~g`). Throws on a
 * malformed specifier.
 */
export function d3Format(specifier: string): (value: number) => string {
  const m = SPEC_RE.exec(specifier);
  if (!m) throw new Error(`invalid format: ${specifier}`);
  let fill = m[1] ?? " ";
  let align = m[2] ?? ">";
  const sign = m[3] ?? "-";
  const symbol = m[4] ?? "";
  let zero = !!m[5];
  const width = m[6] === undefined ? undefined : +m[6];
  let comma = !!m[7];
  let precision = m[8] === undefined ? undefined : +m[8].slice(1);
  let trim = !!m[9];
  let type = m[10] ?? "";

  if (type === "n") {
    comma = true;
    type = "g";
  } else if (type !== "c" && !(type in TYPES)) {
    precision ??= 12;
    trim = true;
    type = "g";
  }
  if (zero || (fill === "0" && align === "=")) {
    zero = true;
    fill = "0";
    align = "=";
  }

  const prefix =
    symbol === "$"
      ? "$"
      : symbol === "#" && /[boxX]/.test(type)
        ? "0" + type.toLowerCase()
        : "";
  const suffix = symbol === "$" ? "" : /[%p]/.test(type) ? "%" : "";
  const formatType = TYPES[type];
  const maybeSuffix = /[defgprs%]/.test(type);
  const p =
    precision === undefined
      ? 6
      : /[gprs]/.test(type)
        ? Math.max(1, Math.min(21, precision))
        : Math.max(0, Math.min(20, precision));

  return (input: number) => {
    let valuePrefix = prefix;
    let valueSuffix = suffix;
    let value: string;
    if (type === "c") {
      valueSuffix = String(input) + valueSuffix;
      value = "";
    } else {
      const x = +input;
      // -0 is not less than 0, but 1 / -0 is.
      let negative = x < 0 || 1 / x < 0;
      let exp = 0;
      if (isNaN(x)) {
        value = "NaN";
      } else if (type === "s") {
        [value, exp] = formatPrefixAuto(Math.abs(x), p);
      } else {
        value = formatType(Math.abs(x), p);
      }
      if (trim) value = formatTrim(value);
      // A negative value that rounds to zero loses its sign unless "+" asks.
      if (negative && +value === 0 && sign !== "+") negative = false;
      valuePrefix =
        (negative
          ? sign === "("
            ? sign
            : MINUS
          : sign === "-" || sign === "("
            ? ""
            : sign) + valuePrefix;
      valueSuffix =
        (type === "s" ? SI_PREFIXES[8 + exp / 3] : "") +
        valueSuffix +
        (negative && sign === "(" ? ")" : "");
      // Split off the fractional or exponent part, which is never grouped.
      if (maybeSuffix) {
        for (let i = 0; i < value.length; i++) {
          const c = value.charCodeAt(i);
          if (c < 48 || c > 57) {
            valueSuffix = value.slice(i) + valueSuffix;
            value = value.slice(0, i);
            break;
          }
        }
      }
    }

    if (comma && !zero) value = group(value, Infinity);
    let length = valuePrefix.length + value.length + valueSuffix.length;
    let padding =
      width !== undefined && length < width ? fill.repeat(width - length) : "";
    // Zero fill is grouped together with the digits.
    if (comma && zero) {
      value = group(
        padding + value,
        padding.length ? width! - valueSuffix.length : Infinity,
      );
      padding = "";
    }
    switch (align) {
      case "<":
        return valuePrefix + value + valueSuffix + padding;
      case "=":
        return valuePrefix + padding + value + valueSuffix;
      case "^":
        length = padding.length >> 1;
        return (
          padding.slice(0, length) +
          valuePrefix +
          value +
          valueSuffix +
          padding.slice(length)
        );
      default:
        return padding + valuePrefix + value + valueSuffix;
    }
  };
}

const SPEC_RE =
  /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
const MINUS = "−";
const SI_PREFIXES = [
  "y",
  "z",
  "a",
  "f",
  "p",
  "n",
  "µ",
  "m",
  "",
  "k",
  "M",
  "G",
  "T",
  "P",
  "E",
  "Z",
  "Y",
];

const TYPES: Record<string, (x: number, p: number) => string> = {
  "%": (x, p) => (x * 100).toFixed(p),
  b: (x) => Math.round(x).toString(2),
  d: formatDecimal,
  e: (x, p) => x.toExponential(p),
  f: (x, p) => x.toFixed(p),
  g: (x, p) => x.toPrecision(p),
  o: (x) => Math.round(x).toString(8),
  p: (x, p) => formatRounded(x * 100, p),
  r: formatRounded,
  s: (x, p) => formatPrefixAuto(x, p)[0],
  X: (x) => Math.round(x).toString(16).toUpperCase(),
  x: (x) => Math.round(x).toString(16),
};

function formatDecimal(x: number): string {
  x = Math.round(x);
  return Math.abs(x) >= 1e21
    ? x.toLocaleString("en").replace(/,/g, "")
    : x.toString(10);
}

/**
 * Significant digits and decimal exponent of a positive `x` rounded to `p`
 * significant digits: `decimalParts(1.23)` is `["123", 0]`. Null for
 * NaN and infinities.
 */
function decimalParts(x: number, p?: number): [string, number] | null {
  const s = p ? x.toExponential(p - 1) : x.toExponential();
  const i = s.indexOf("e");
  if (i < 0) return null;
  const coefficient = s.slice(0, i);
  return [
    coefficient.length > 1
      ? coefficient[0] + coefficient.slice(2)
      : coefficient,
    +s.slice(i + 1),
  ];
}

function formatRounded(x: number, p: number): string {
  const d = decimalParts(x, p);
  if (!d) return String(x);
  const [coefficient, exponent] = d;
  return exponent < 0
    ? "0." + "0".repeat(-exponent - 1) + coefficient
    : coefficient.length > exponent + 1
      ? coefficient.slice(0, exponent + 1) +
        "." +
        coefficient.slice(exponent + 1)
      : coefficient + "0".repeat(exponent - coefficient.length + 1);
}

/** The digits scaled to an SI prefix, and that prefix's exponent. */
function formatPrefixAuto(x: number, p: number): [string, number] {
  const d = decimalParts(x, p);
  if (!d) return [String(x), 0];
  const [coefficient, exponent] = d;
  const prefixExp = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3;
  const i = exponent - prefixExp + 1;
  const n = coefficient.length;
  const digits =
    i === n
      ? coefficient
      : i > n
        ? coefficient + "0".repeat(i - n)
        : i > 0
          ? coefficient.slice(0, i) + "." + coefficient.slice(i)
          : "0." + "0".repeat(-i) + decimalParts(x, Math.max(0, p + i - 1))![0];
  return [digits, prefixExp];
}

/** Trims insignificant zeros: `1.2000k` → `1.2k`, `1.0` → `1`. */
function formatTrim(s: string): string {
  let i0 = -1;
  let i1 = -1;
  out: for (let i = 1; i < s.length; i++) {
    switch (s[i]) {
      case ".":
        i0 = i1 = i;
        break;
      case "0":
        if (i0 === 0) i0 = i;
        i1 = i;
        break;
      default:
        if (!+s[i]) break out;
        if (i0 > 0) i0 = 0;
        break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

/** Thousands separators in groups of three, capped at `width` characters. */
function group(value: string, width: number): string {
  const parts: string[] = [];
  let i = value.length;
  let length = 0;
  while (i > 0) {
    const g = length + 4 > width ? Math.max(1, width - length) : 3;
    parts.push(value.substring((i -= g), i + g));
    if ((length += g + 1) > width) break;
  }
  return parts.reverse().join(",");
}
