import { onMounted, ref, type Ref } from "vue";
import type { ChartData } from "./axes.js";
import { isAllDates, parseDate, type DateTimezone } from "./dateAxis.js";

/**
 * Accepted shapes for an `x` array. Numeric arrays (typed or plain) plot
 * as numbers; string-or-`Date` arrays switch the axis to dates when every
 * element parses.
 */
export type ChartXInput = ChartData | readonly (string | Date)[];

/**
 * Whether the x axis is a date axis: every non-empty input parses as dates.
 * No inputs (or only empty ones) means a numeric axis.
 */
export function isDateXAxis(
  inputs: Iterable<ChartXInput | undefined>,
  tz: DateTimezone,
): boolean {
  let any = false;
  for (const x of inputs) {
    if (!x || x.length === 0) continue;
    if (!isAllDates(x, tz)) return false;
    any = true;
  }
  return any;
}

/** Convert an x input to numbers: epoch ms on a date axis, else as given. */
export function toNumericX(
  x: ChartXInput | undefined,
  isDate: boolean,
  tz: DateTimezone,
): ChartData | undefined {
  if (!x) return undefined;
  if (!isDate) return x as ChartData;
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    out[i] = parseDate(x[i], tz) ?? NaN;
  }
  return out;
}

// One measuring canvas for every chart on the page.
let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Width of `text` in a CSS `font`, or null where canvas is unavailable. */
export function measureText(text: string, font: string): number | null {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return null;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * Whether tick labels fit between their ticks along an axis of `size`
 * pixels spanning `[min, max]`, measured in `font`. Trusts the caller's
 * density budget where text cannot be measured.
 */
export function tickLabelsFit(
  values: number[],
  opts: {
    min: number;
    max: number;
    size: number;
    font: string;
    gap: number;
    label: (value: number, index: number) => string;
  },
): boolean {
  if (values.length < 2) return true;
  let step = Infinity;
  for (let i = 1; i < values.length; i++) {
    step = Math.min(step, values[i] - values[i - 1]);
  }
  const spacing = (step / (opts.max - opts.min)) * opts.size;
  let widest = 0;
  for (let i = 0; i < values.length; i++) {
    const w = measureText(opts.label(values[i], i), opts.font);
    if (w === null) return true;
    widest = Math.max(widest, w);
  }
  return spacing >= widest + opts.gap;
}

/**
 * Font the chart's text renders in, read from the svg once mounted and
 * again when web fonts finish loading, so measured label widths match
 * the painted glyphs rather than a fallback face.
 */
export function useChartFontFamily(
  svg: () => SVGSVGElement | null | undefined,
): Ref<string> {
  const family = ref("sans-serif");
  onMounted(() => {
    const read = () => {
      const el = svg();
      if (el) family.value = getComputedStyle(el).fontFamily || "sans-serif";
    };
    read();
    document.fonts?.ready.then(read);
  });
  return family;
}
