/**
 * A date formatter from a d3-time-format (strftime-style) specifier, the
 * grammar Vega-Lite uses for temporal `format`, e.g. `"%b %d, %Y"`. Output
 * matches d3-time-format's default (en-US) locale. `timezone` picks UTC
 * (default, like the charts' date axes) or the browser's local time. Pass
 * the result anywhere a chart takes a `DateFormat`. A chart does not pass
 * its own `timezone` on, so give a `timezone="local"` chart's formatter
 * `{ timezone: "local" }` too.
 *
 * Directives: `%a %A %b %B %c %d %e %f %g %G %H %I %j %L %m %M %p %q %Q
 * %s %S %u %U %V %w %W %x %X %y %Y %Z %%`, with the padding modifiers
 * `-` (none), `_` (space) and `0`. An unknown directive prints its letter;
 * an invalid date prints names as empty and numbers as `NaN`, like d3.
 */
export function d3TimeFormat(
  specifier: string,
  opts: { timezone?: "utc" | "local" } = {},
): (date: number | Date) => string {
  const utc = (opts.timezone ?? "utc") === "utc";
  const parts = compile(specifier);
  return (date) => render(parts, fields(+date, utc), utc);
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
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
const PADS: Record<string, string> = { "-": "", _: " ", "0": "0" };

/** Literal text, or a directive with its padding fill. */
type Part = string | { c: string; pad: string };

const LOCALE_FORMATS: Record<string, Part[]> = {};
LOCALE_FORMATS.x = compile("%-m/%-d/%Y");
LOCALE_FORMATS.X = compile("%-I:%M:%S %p");
LOCALE_FORMATS.c = [...LOCALE_FORMATS.x, ", ", ...LOCALE_FORMATS.X];
const MS_PER_DAY = 86_400_000;

interface Fields {
  ms: number;
  y: number;
  m: number;
  d: number;
  H: number;
  M: number;
  S: number;
  L: number;
  /** Day of the week, 0 = Sunday. */
  dow: number;
  /** Minutes east of UTC. */
  offset: number;
}

function fields(ms: number, utc: boolean): Fields {
  const t = new Date(ms);
  return utc
    ? {
        ms,
        y: t.getUTCFullYear(),
        m: t.getUTCMonth(),
        d: t.getUTCDate(),
        H: t.getUTCHours(),
        M: t.getUTCMinutes(),
        S: t.getUTCSeconds(),
        L: t.getUTCMilliseconds(),
        dow: t.getUTCDay(),
        offset: 0,
      }
    : {
        ms,
        y: t.getFullYear(),
        m: t.getMonth(),
        d: t.getDate(),
        H: t.getHours(),
        M: t.getMinutes(),
        S: t.getSeconds(),
        L: t.getMilliseconds(),
        dow: t.getDay(),
        offset: -t.getTimezoneOffset(),
      };
}

/** Days from Jan 1 of `y` to the civil date `y-m-d`, ignoring DST. */
function dayOfYear(y: number, m: number, d: number): number {
  return (civilDay(y, m, d) - civilDay(y, 0, 1)) / MS_PER_DAY;
}

function civilDay(y: number, m: number, d: number): number {
  const t = new Date(Date.UTC(2000, m, d));
  t.setUTCFullYear(y);
  return t.getTime();
}

/** Weekday (0 = Sunday) of Jan 1 of `y`. */
function jan1Dow(y: number): number {
  return new Date(civilDay(y, 0, 1)).getUTCDay();
}

/** How many `weekday`s fall on or before day `doy` of a year (Jan 1 = 0). */
function weekdaysThrough(y: number, doy: number, weekday: number): number {
  const first = (weekday - jan1Dow(y) + 7) % 7;
  return doy < first ? 0 : Math.floor((doy - first) / 7) + 1;
}

/**
 * The Thursday of the ISO week holding a date, which names its ISO week
 * and year: the Thursday on or before for Thursday-Sunday, else after.
 */
function isoThursday(f: Fields): { y: number; doy: number } {
  const shift = f.dow >= 4 || f.dow === 0 ? -((f.dow + 3) % 7) : 4 - f.dow;
  const t = new Date(civilDay(f.y, f.m, f.d) + shift * MS_PER_DAY);
  const y = t.getUTCFullYear();
  return { y, doy: dayOfYear(y, t.getUTCMonth(), t.getUTCDate()) };
}

function pad(value: number, fill: string, width: number): string {
  const sign = value < 0 ? "-" : "";
  const s = String(sign ? -value : value);
  return sign + (s.length < width ? fill.repeat(width - s.length) + s : s);
}

function directive(c: string, f: Fields, p: string, utc: boolean): string {
  switch (c) {
    case "a":
      return DAYS[f.dow]?.slice(0, 3) ?? "";
    case "A":
      return DAYS[f.dow] ?? "";
    case "b":
      return MONTHS[f.m]?.slice(0, 3) ?? "";
    case "B":
      return MONTHS[f.m] ?? "";
    case "c":
    case "x":
    case "X":
      return render(LOCALE_FORMATS[c], f, utc);
    case "d":
    case "e":
      return pad(f.d, p, 2);
    case "f":
      return pad(f.L, p, 3) + "000";
    case "g":
      return pad(isoThursday(f).y % 100, p, 2);
    case "G":
      return pad(isoThursday(f).y % 10000, p, 4);
    case "H":
      return pad(f.H, p, 2);
    case "I":
      return pad(f.H % 12 || 12, p, 2);
    case "j":
      return pad(1 + dayOfYear(f.y, f.m, f.d), p, 3);
    case "L":
      return pad(f.L, p, 3);
    case "m":
      return pad(f.m + 1, p, 2);
    case "M":
      return pad(f.M, p, 2);
    case "p":
      return f.H >= 12 ? "PM" : "AM";
    case "q":
      return String(1 + ~~(f.m / 3));
    case "Q":
      return String(f.ms);
    case "s":
      return String(Math.floor(f.ms / 1000));
    case "S":
      return pad(f.S, p, 2);
    case "u":
      return String(f.dow === 0 ? 7 : f.dow);
    case "U":
      return pad(weekdaysThrough(f.y, dayOfYear(f.y, f.m, f.d), 0), p, 2);
    case "V": {
      const t = isoThursday(f);
      return pad(weekdaysThrough(t.y, t.doy, 4), p, 2);
    }
    case "w":
      return String(f.dow);
    case "W":
      return pad(weekdaysThrough(f.y, dayOfYear(f.y, f.m, f.d), 1), p, 2);
    case "y":
      return pad(f.y % 100, p, 2);
    case "Y":
      return pad(f.y % 10000, p, 4);
    case "Z": {
      if (utc) return "+0000";
      // Minutes west of UTC, as d3 reads them (an invalid date gives "+00NaN").
      let z = -f.offset;
      const sign = z > 0 ? "-" : ((z = -z), "+");
      return sign + pad((z / 60) | 0, "0", 2) + pad(z % 60, "0", 2);
    }
    default:
      // "%%" and unknown directives print the character.
      return c;
  }
}

function compile(specifier: string): Part[] {
  const parts: Part[] = [];
  let j = 0;
  for (let i = 0; i < specifier.length; i++) {
    if (specifier.charCodeAt(i) !== 37) continue;
    if (i > j) parts.push(specifier.slice(j, i));
    let c = specifier.charAt(++i);
    let pad = PADS[c];
    if (pad !== undefined) c = specifier.charAt(++i);
    else pad = c === "e" ? " " : "0";
    parts.push({ c, pad });
    j = i + 1;
  }
  if (j < specifier.length) parts.push(specifier.slice(j));
  return parts;
}

function render(parts: Part[], f: Fields, utc: boolean): string {
  let out = "";
  for (const part of parts) {
    out +=
      typeof part === "string" ? part : directive(part.c, f, part.pad, utc);
  }
  return out;
}
