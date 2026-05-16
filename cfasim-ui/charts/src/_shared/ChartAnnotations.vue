<script setup lang="ts">
import { computed } from "vue";
import type { ChartAnnotation } from "./annotations.js";

const props = withDefaults(
  defineProps<{
    annotations?: readonly ChartAnnotation[];
    /**
     * Project an annotation's `(x, y)` (data coordinates) to pixel
     * coordinates on the chart canvas. Return `null` to drop the
     * annotation (e.g. an off-projection point on a map).
     */
    project: (x: number, y: number) => { x: number; y: number } | null;
  }>(),
  {
    annotations: () => [],
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
// Nudge the start of the curve a few pixels in the offset direction so
// it doesn't sit directly on top of axis lines or gridlines at the
// anchor.
const START_NUDGE_PX = 3;

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
  arrow: boolean;
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
    const textAnchor =
      a.textAnchor ?? (offsetX > 0 ? "start" : offsetX < 0 ? "end" : "middle");

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
      pointerPath: buildPointerPath(
        projected.x,
        projected.y,
        labelX,
        labelY,
        fontSize,
        a.pointer ?? "curved",
      ),
      lineColor,
      lineWidth,
      arrow: a.arrow ?? true,
    });
  }
  return out;
});

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
function buildPointerPath(
  ax: number,
  ay: number,
  lx: number,
  ly: number,
  fontSize: number,
  pointer: "curved" | "straight" | "none",
): string {
  if (pointer === "none") return "";
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
    if (len <= ANCHOR_GAP_PX + LABEL_GAP_PX) return "";
    const ux = segDx / len;
    const uy = segDy / len;
    const sx = ax + ux * ANCHOR_GAP_PX;
    const sy = ay + uy * ANCHOR_GAP_PX;
    const ex = lx - ux * LABEL_GAP_PX;
    const eyClamped = ey - uy * LABEL_GAP_PX;
    return `M${sx},${sy} L${ex},${eyClamped}`;
  }

  const adjDy = targetY - ay;

  // Skip the curve if one dimension is too small to clear its gap.
  if (Math.abs(adjDy) <= ANCHOR_GAP_PX || Math.abs(dx) <= LABEL_GAP_PX) {
    return "";
  }

  const xDir = Math.sign(dx);
  const yDir = Math.sign(adjDy);
  // Nudge the start horizontally toward the label so the line doesn't
  // sit on top of axis/grid lines passing through the anchor.
  const sx = ax + xDir * START_NUDGE_PX;
  const sy = ay + yDir * ANCHOR_GAP_PX;
  const ex = lx - xDir * LABEL_GAP_PX;
  const ey = targetY;
  // Control sits at (sx, targetY) so the curve emerges from the nudged
  // start tangent vertically and lands on the label horizontally —
  // a clean quarter-arc shape.
  return `M${sx},${sy} Q${sx},${targetY} ${ex},${ey}`;
}
</script>

<template>
  <defs>
    <marker
      id="chart-annotation-arrow"
      viewBox="0 0 8 8"
      refX="7"
      refY="4"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
    >
      <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
    </marker>
  </defs>
  <g class="chart-annotations" pointer-events="none">
    <template v-for="(item, i) in items" :key="i">
      <path
        v-if="item.pointerPath"
        :d="item.pointerPath"
        fill="none"
        :stroke="item.lineColor"
        :style="{ color: item.lineColor }"
        :stroke-width="item.lineWidth"
        stroke-linecap="round"
        :marker-start="item.arrow ? 'url(#chart-annotation-arrow)' : undefined"
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
