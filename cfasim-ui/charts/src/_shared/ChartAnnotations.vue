<script setup lang="ts">
import { computed } from "vue";
import type { ChartAnnotation } from "./annotations.js";
import type { ChartBounds } from "./useChartPadding.js";

const props = withDefaults(
  defineProps<{
    annotations?: readonly ChartAnnotation[];
    /**
     * Project an annotation's `(x, y)` (data coordinates) to pixel
     * coordinates on the chart canvas. Return `null` to drop the
     * annotation (e.g. an off-projection point on a map).
     */
    project: (x: number, y: number) => { x: number; y: number } | null;
    /**
     * Pixel-space bounds of the plot area. Required for rule annotations
     * so the line can span the full plot. When omitted, rule annotations
     * are skipped.
     */
    bounds?: ChartBounds;
  }>(),
  {
    annotations: () => [],
    bounds: undefined,
  },
);

// Match the x/y axis label styling so annotations blend in by default.
const DEFAULT_FONT_SIZE = 13;
const DEFAULT_FONT_WEIGHT = "normal";
const BOLD_FONT_WEIGHT = 700;
const DEFAULT_HALO_COLOR = "var(--color-bg-0, #fff)";
const DEFAULT_HALO_WIDTH = 3;
const DEFAULT_LINE_WIDTH = 1;
const ANCHOR_GAP_PX = 4;
const LABEL_GAP_PX = 6;
const LINE_HEIGHT_RATIO = 1.2;
// Ratio of font-size that puts the pointer endpoint at the visual center
// of the first text line (between baseline and cap-height). Lands on the
// x-height middle for most fonts.
const FIRST_LINE_CENTER_RATIO = 0.35;

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

interface RenderedAnnotation {
  lines: TextRun[][];
  textX: number;
  textY: number;
  textAnchor: "start" | "middle" | "end";
  dy: number;
  fontSize: number;
  fontWeight: string | number;
  color: string;
  haloColor: string;
  haloWidth: number;
  pointerPath: string;
  lineColor: string;
  lineWidth: number;
  lineDash?: string;
  arrow: boolean;
  // Inline arrow geometry. Rendered as a triangle with explicit fill so it
  // renders correctly in Safari (which doesn't support `context-stroke` on
  // SVG markers). Present only when an arrow should be drawn.
  arrowTip?: { x: number; y: number; angle: number };
  rule?: { x1: number; y1: number; x2: number; y2: number };
}

function resolveDash(
  dash: string | number | readonly number[] | undefined,
): string | undefined {
  if (dash === undefined) return undefined;
  if (typeof dash === "number") return `${dash} ${dash}`;
  if (typeof dash === "string") return dash;
  return dash.join(" ");
}

/**
 * Parse a single line for `**bold**` and `_italic_` runs. Markers
 * compose (`**_both_**`) and are forgiving — an unclosed marker carries
 * its state through the rest of the line.
 */
function parseInline(line: string): TextRun[] {
  const out: TextRun[] = [];
  let bold = false;
  let italic = false;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ text: buf, bold, italic });
    buf = "";
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "*" && line[i + 1] === "*") {
      flush();
      bold = !bold;
      i++;
    } else if (ch === "_") {
      flush();
      italic = !italic;
    } else {
      buf += ch;
    }
  }
  flush();
  return out.length === 0 ? [{ text: "", bold: false, italic: false }] : out;
}

const items = computed<RenderedAnnotation[]>(() => {
  const out: RenderedAnnotation[] = [];
  for (const a of props.annotations) {
    const projected = props.project(a.x, a.y);
    if (!projected) continue;
    if (!isFinite(projected.x) || !isFinite(projected.y)) continue;

    const pointer = a.pointer ?? "curved";
    const isRule = pointer.startsWith("rule");

    // Rule pointers require known plot bounds.
    if (isRule && !props.bounds) continue;

    const { x: offsetX, y: offsetY } = a.offset;
    const labelX = projected.x + offsetX;
    const labelY = projected.y + offsetY;
    const color = a.color ?? "currentColor";
    const fontSize = a.fontSize ?? DEFAULT_FONT_SIZE;
    const fontWeight = a.fontWeight ?? DEFAULT_FONT_WEIGHT;
    const haloColor = a.haloColor ?? DEFAULT_HALO_COLOR;
    const haloWidth = a.haloWidth ?? DEFAULT_HALO_WIDTH;
    const lineColor = a.lineColor ?? color;
    const lineWidth = a.lineWidth ?? DEFAULT_LINE_WIDTH;
    const lineDash = resolveDash(a.lineDash);
    const textAnchor =
      a.textAnchor ?? (offsetX > 0 ? "start" : offsetX < 0 ? "end" : "middle");

    let rule: RenderedAnnotation["rule"];
    let pointerPath = "";
    let arrowTip: RenderedAnnotation["arrowTip"];
    const wantArrow = !isRule && (a.arrow ?? true);
    if (isRule && props.bounds) {
      rule = computeRule(pointer, projected.x, projected.y, props.bounds);
    } else {
      const built = buildPointerPath(
        projected.x,
        projected.y,
        labelX,
        labelY,
        fontSize,
        pointer as "curved" | "straight" | "none",
      );
      pointerPath = built.path;
      if (wantArrow && built.arrow) arrowTip = built.arrow;
    }

    out.push({
      lines: a.text.split("\n").map(parseInline),
      textX: labelX,
      textY: labelY,
      textAnchor,
      dy: fontSize * LINE_HEIGHT_RATIO,
      fontSize,
      fontWeight,
      color,
      haloColor,
      haloWidth,
      pointerPath,
      lineColor,
      lineWidth,
      lineDash,
      arrow: wantArrow,
      arrowTip,
      rule,
    });
  }
  return out;
});

/**
 * Endpoints for a rule line through the anchor.
 * - `ruleX` / `ruleY`: full plot span on the named axis.
 * - `ruleUp` / `ruleDown` / `ruleFromLeft` / `ruleFromRight`: partial
 *   rule from one plot edge in to the anchor.
 */
function computeRule(
  pointer: string,
  ax: number,
  ay: number,
  b: ChartBounds,
): { x1: number; y1: number; x2: number; y2: number } {
  switch (pointer) {
    case "ruleX":
      return { x1: ax, y1: b.top, x2: ax, y2: b.bottom };
    case "ruleY":
      return { x1: b.left, y1: ay, x2: b.right, y2: ay };
    case "ruleUp":
      return { x1: ax, y1: b.bottom, x2: ax, y2: ay };
    case "ruleDown":
      return { x1: ax, y1: b.top, x2: ax, y2: ay };
    case "ruleFromLeft":
      return { x1: b.left, y1: ay, x2: ax, y2: ay };
    case "ruleFromRight":
      return { x1: b.right, y1: ay, x2: ax, y2: ay };
    default:
      return { x1: ax, y1: ay, x2: ax, y2: ay };
  }
}

/**
 * Build the pointer line from the anchor to the label.
 *
 * - When the label has offset in only one dimension, the line is
 *   straight (vertical or horizontal) ending at the label's baseline.
 * - When both dimensions have offset, the line is a quarter-arc:
 *   a quadratic Bezier with the control point at `(anchorX, firstLineY)`
 *   where `firstLineY` is the visual center of the first line of text
 *   (slightly above the baseline). The curve emerges from the anchor
 *   vertically toward the label's row, then bends horizontally into the
 *   label so the endpoint reads as pointing at the first line — not at
 *   the bottom of a multi-line block.
 */
interface PointerGeom {
  path: string;
  // Tip position and rotation (degrees) for the inline arrow head. The
  // arrow points opposite the path's start tangent — matching the look of
  // `marker-start` with `orient="auto-start-reverse"`, but rendered as a
  // plain triangle so the color works in Safari.
  arrow?: { x: number; y: number; angle: number };
}

function buildPointerPath(
  ax: number,
  ay: number,
  lx: number,
  ly: number,
  fontSize: number,
  pointer: "curved" | "straight" | "none",
): PointerGeom {
  if (pointer === "none") return { path: "" };
  const dx = lx - ax;
  const dy = ly - ay;

  // Target the visual center of the first line so multi-line text
  // doesn't have the pointer dive below the whole block.
  const targetY = ly - fontSize * FIRST_LINE_CENTER_RATIO;

  // Pure horizontal or vertical → straight line at baseline, no curve.
  // Force straight when explicitly requested.
  if (dx === 0 || dy === 0 || pointer === "straight") {
    // For straight pointers, aim at first-line-center (so multi-line text
    // still points at the first line) — but only when the anchor isn't
    // already at exactly the same Y (pure horizontal offset). The pure
    // horizontal case stays on the baseline so it's a real horizontal line.
    const ey = dy === 0 ? ly : targetY;
    const segDx = lx - ax;
    const segDy = ey - ay;
    const len = Math.hypot(segDx, segDy);
    if (len <= ANCHOR_GAP_PX + LABEL_GAP_PX) return { path: "" };
    const ux = segDx / len;
    const uy = segDy / len;
    const sx = ax + ux * ANCHOR_GAP_PX;
    const sy = ay + uy * ANCHOR_GAP_PX;
    const ex = lx - ux * LABEL_GAP_PX;
    const eyClamped = ey - uy * LABEL_GAP_PX;
    // Arrow points back toward the anchor (opposite of (ux, uy)).
    const angle = (Math.atan2(-uy, -ux) * 180) / Math.PI;
    return {
      path: `M${sx},${sy} L${ex},${eyClamped}`,
      arrow: { x: sx, y: sy, angle },
    };
  }

  const adjDy = targetY - ay;

  // Skip the curve if one dimension is too small to clear its gap.
  if (Math.abs(adjDy) <= ANCHOR_GAP_PX || Math.abs(dx) <= LABEL_GAP_PX) {
    return { path: "" };
  }

  const xDir = Math.sign(dx);
  const yDir = Math.sign(adjDy);
  // Start the curve directly above/below the anchor so the arrow head
  // lines up with the data point rather than sitting off to one side.
  const sx = ax;
  const sy = ay + yDir * ANCHOR_GAP_PX;
  const ex = lx - xDir * LABEL_GAP_PX;
  const ey = targetY;
  // Control sits at (sx, targetY) so the curve emerges from the start
  // tangent vertically and lands on the label horizontally —
  // a clean quarter-arc shape. The start tangent is (0, yDir), so the
  // arrow points (0, -yDir) — straight up when yDir=1, down when yDir=-1.
  const angle = yDir > 0 ? -90 : 90;
  return {
    path: `M${sx},${sy} Q${sx},${targetY} ${ex},${ey}`,
    arrow: { x: sx, y: sy, angle },
  };
}
</script>

<template>
  <g class="chart-annotations" pointer-events="none">
    <template v-for="(item, i) in items" :key="i">
      <line
        v-if="item.rule"
        :x1="item.rule.x1"
        :y1="item.rule.y1"
        :x2="item.rule.x2"
        :y2="item.rule.y2"
        :stroke="item.lineColor"
        :stroke-width="item.lineWidth"
        :stroke-dasharray="item.lineDash"
        stroke-linecap="round"
      />
      <path
        v-if="item.pointerPath"
        :d="item.pointerPath"
        fill="none"
        :stroke="item.lineColor"
        :stroke-width="item.lineWidth"
        :stroke-dasharray="item.lineDash"
        stroke-linecap="round"
      />
      <!--
        Inline arrow head. Drawn as an explicit triangle (not via
        `<marker>`) because Safari does not implement `context-stroke` on
        marker fills, so a shared marker rendered as black instead of the
        line color.
      -->
      <polygon
        v-if="item.arrowTip"
        points="0,0 -6,-3 -6,3"
        :fill="item.lineColor"
        :transform="`translate(${item.arrowTip.x} ${item.arrowTip.y}) rotate(${item.arrowTip.angle})`"
      />
      <text
        :x="item.textX"
        :y="item.textY"
        :text-anchor="item.textAnchor"
        :font-size="item.fontSize"
        :font-weight="item.fontWeight"
        :fill="item.color"
        :stroke="item.haloColor"
        :stroke-width="item.haloWidth"
        stroke-linejoin="round"
        paint-order="stroke fill"
      >
        <tspan
          v-for="(line, li) in item.lines"
          :key="li"
          :x="item.textX"
          :dy="li === 0 ? 0 : item.dy"
        >
          <tspan
            v-for="(run, ri) in line"
            :key="ri"
            :font-weight="run.bold ? BOLD_FONT_WEIGHT : undefined"
            :font-style="run.italic ? 'italic' : undefined"
            >{{ run.text }}</tspan
          >
        </tspan>
      </text>
    </template>
  </g>
</template>
