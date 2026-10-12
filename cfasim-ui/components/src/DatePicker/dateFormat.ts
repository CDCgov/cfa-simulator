export interface DateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

export const DEFAULT_DATE_FORMAT = "yyyy-mm-dd";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Token = "yyyy" | "yy" | "mmmm" | "mmm" | "mm" | "m" | "dd" | "d";
type Part = { token: Token } | { literal: string };

// Longest first so "yyyy" wins over "yy" and "mmmm" over "mmm"/"mm".
const TOKEN_RE = /yyyy|yy|mmmm|mmm|mm|m|dd|d/gi;

const cache = new Map<string, { parts: Part[]; re: RegExp }>();

function compile(format: string) {
  let hit = cache.get(format);
  if (hit) return hit;
  const parts: Part[] = [];
  let last = 0;
  for (const m of format.matchAll(TOKEN_RE)) {
    if (m.index > last) parts.push({ literal: format.slice(last, m.index) });
    parts.push({ token: m[0].toLowerCase() as Token });
    last = m.index + m[0].length;
  }
  if (last < format.length) parts.push({ literal: format.slice(last) });

  // Parsing is lenient: numeric fields accept 1 or 2 digits regardless of
  // padding, month names are case-insensitive, and any whitespace run in a
  // literal matches any whitespace run in the input.
  const source = parts
    .map((p) => {
      if ("literal" in p) {
        return p.literal
          .split(/\s+/)
          .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("\\s+");
      }
      switch (p.token) {
        case "yyyy":
          return "(\\d{4})";
        case "yy":
          return "(\\d{2})";
        case "mmmm":
        case "mmm":
          return "([A-Za-z]+)";
        default:
          return "(\\d{1,2})";
      }
    })
    .join("");
  hit = { parts, re: new RegExp(`^\\s*${source}\\s*$`, "i") };
  cache.set(format, hit);
  return hit;
}

function monthFromName(name: string): number | undefined {
  const n = name.toLowerCase();
  const i = MONTHS.findIndex(
    (m) => m.toLowerCase() === n || m.slice(0, 3).toLowerCase() === n,
  );
  return i === -1 ? undefined : i + 1;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parse `value` against `format`. Tokens (case-insensitive): `yyyy`, `yy`
 * (2000-2099), `mmmm` (January), `mmm` (Jan), `mm` (01), `m` (1), `dd` (05),
 * `d` (5). Anything else is a literal. Returns `null` for input that does not
 * match or is not a real calendar date.
 */
export function parseDate(
  value: string,
  format: string = DEFAULT_DATE_FORMAT,
): DateParts | null {
  const { parts, re } = compile(format);
  const match = re.exec(value);
  if (!match) return null;
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  let g = 1;
  for (const p of parts) {
    if ("literal" in p) continue;
    const s = match[g++];
    switch (p.token) {
      case "yyyy":
        year = Number(s);
        break;
      case "yy":
        year = 2000 + Number(s);
        break;
      case "mmmm":
      case "mmm":
        month = monthFromName(s);
        if (month === undefined) return null;
        break;
      case "mm":
      case "m":
        month = Number(s);
        break;
      default:
        day = Number(s);
    }
  }
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

/** Format date parts with the same tokens `parseDate` accepts. */
export function formatDate(
  date: DateParts,
  format: string = DEFAULT_DATE_FORMAT,
): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return compile(format)
    .parts.map((p) => {
      if ("literal" in p) return p.literal;
      switch (p.token) {
        case "yyyy":
          return pad(date.year, 4);
        case "yy":
          return pad(date.year % 100);
        case "mmmm":
          return MONTHS[date.month - 1];
        case "mmm":
          return MONTHS[date.month - 1].slice(0, 3);
        case "mm":
          return pad(date.month);
        case "m":
          return String(date.month);
        case "dd":
          return pad(date.day);
        case "d":
          return String(date.day);
      }
    })
    .join("");
}

export function compareDates(a: DateParts, b: DateParts) {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

const DAY_MS = 86_400_000;
const utc = (d: DateParts) => Date.UTC(d.year, d.month - 1, d.day);

/** Whole days from `from` to `to`. */
export function daysBetween(from: DateParts, to: DateParts) {
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

export function addDays(date: DateParts, days: number): DateParts {
  const d = new Date(utc(date) + days * DAY_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}
