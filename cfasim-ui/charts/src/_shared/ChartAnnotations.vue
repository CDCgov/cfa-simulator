<script setup lang="ts">
import { computed } from "vue";
import type { ChartAnnotation } from "./annotations.js";
import { blendStyle, type BlendMode } from "./chartProps.js";
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
const DEFAULT_OUTLINE_COLOR = "var(--color-bg-0, #fff)";
const DEFAULT_OUTLINE_WIDTH = 3;
const DEFAULT_LINE_WIDTH = 1;
const ANCHOR_GAP_PX = 2;
const LABEL_GAP_PX = 6;
const LINE_HEIGHT_RATIO = 1.2;
// Ratio of font-size that puts the pointer endpoint at the visual center
// of a text line (between baseline and cap-height). Lands on the x-height
// middle for most fonts.
const LINE_CENTER_RATIO = 0.35;
// Arrow head: tip at the origin pointing along +x, 6px long, 6px wide.
const ARROW_LENGTH_PX = 6;
const ARROW_POINTS = `0,0 -${ARROW_LENGTH_PX},-3 -${ARROW_LENGTH_PX},3`;

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
  outlineColor: string;
  outlineWidth: number;
  textOutlineColor: string;
  textOutlineWidth: number;
  textTransform?: string;
  textBaseline?: "hanging";
  blendMode?: BlendMode;
  pointerPath: string;
  lineColor: string;
  lineWidth: number;
  lineDash?: string;
  arrow: boolean;
  // Inline arrow geometry. Rendered as a triangle with explicit fill so it
  // renders correctly in Safari (which doesn't support `context-stroke` on
  // SVG markers). Present only when an arrow should be drawn.
  arrowTip?: { x: number; y: number; angle: number };
  arrowTransform: string;
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
    const outlineColor = a.outlineColor ?? DEFAULT_OUTLINE_COLOR;
    const outlineWidth = a.outlineWidth ?? DEFAULT_OUTLINE_WIDTH;
    const textOutlineColor = a.textOutlineColor ?? outlineColor;
    const textOutlineWidth = a.textOutlineWidth ?? outlineWidth;
    const lineColor = a.lineColor ?? color;
    const lineWidth = a.lineWidth ?? DEFAULT_LINE_WIDTH;
    const lineDash = resolveDash(a.lineDash);
    const alignMap = { left: "start", center: "middle", right: "end" } as const;
    const align =
      a.align ?? (offsetX > 0 ? "left" : offsetX < 0 ? "right" : "center");
    const textAnchor = alignMap[align];

    const lines = a.text.split("\n").map(parseInline);

    // Rotated text keeps to the side of its position facing away from
    // the anchor: when the glyph body (text-space "up", rotated) would
    // extend back toward the anchor, hang the text from its baseline
    // instead, and when it extends away, shift a multi-line block so
    // its last line sits on the baseline.
    let textY = labelY;
    let textBaseline: RenderedAnnotation["textBaseline"];
    if (a.rotate) {
      const rad = (a.rotate * Math.PI) / 180;
      const toward = offsetX * Math.sin(rad) - offsetY * Math.cos(rad);
      if (toward < 0) textBaseline = "hanging";
      else if (toward > 0 && lines.length > 1) {
        textY -= (lines.length - 1) * fontSize * LINE_HEIGHT_RATIO;
      }
    }

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
        lines.length,
        pointer as "curved" | "straight" | "none",
      );
      pointerPath = built.path;
      if (wantArrow && built.arrow) arrowTip = built.arrow;
    }

    out.push({
      lines,
      textX: labelX,
      textY,
      textAnchor,
      dy: fontSize * LINE_HEIGHT_RATIO,
      fontSize,
      fontWeight,
      color,
      outlineColor,
      outlineWidth,
      textOutlineColor,
      textOutlineWidth,
      textTransform: a.rotate
        ? `rotate(${a.rotate} ${labelX} ${labelY})`
        : undefined,
      textBaseline,
      blendMode: a.blendMode,
      pointerPath,
      lineColor,
      lineWidth,
      lineDash,
      arrow: wantArrow,
      arrowTip,
      arrowTransform: arrowTip
        ? `translate(${arrowTip.x} ${arrowTip.y}) rotate(${arrowTip.angle})`
        : "",
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
 *   a quadratic Bezier with the control point at `(anchorX, targetY)`
 *   where `targetY` is the visual center of the text line nearest the
 *   anchor (slightly above its baseline). The curve emerges from the
 *   anchor vertically toward the label's row, then bends horizontally
 *   into the label.
 *
 * `targetY` tracks the *near* edge of the text block: the first line
 * when the label sits below the anchor (connector points up at the top
 * line), the last line when the label sits above the anchor (connector
 * points up at the bottom line) — so multi-line text above the point
 * connects to its bottom edge instead of having the line cut through it.
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
  lineCount: number,
  pointer: "curved" | "straight" | "none",
): PointerGeom {
  if (pointer === "none") return { path: "" };
  const dx = lx - ax;
  const dy = ly - ay;

  // Aim at the visual center of the text line nearest the anchor: the
  // first (top) line when the label is below the anchor, the last
  // (bottom) line when the label is above it. That keeps the connector
  // attached to the block's near edge instead of cutting through the
  // lower lines of text that sits above the point.
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const nearestBaseline = dy < 0 ? ly + (lineCount - 1) * lineHeight : ly;
  const targetY = nearestBaseline - fontSize * LINE_CENTER_RATIO;

  // Pure horizontal or vertical → straight line at baseline, no curve.
  // Force straight when explicitly requested.
  if (dx === 0 || dy === 0 || pointer === "straight") {
    // For straight pointers, aim at the near-line center (so multi-line
    // text above the point connects to its bottom edge) — but only when
    // the anchor isn't already at exactly the same Y (pure horizontal
    // offset). The pure horizontal case stays on the baseline so it's a
    // real horizontal line.
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
  // tangent vertically and lands on the label horizontally, a clean
  // quarter-arc shape. The arrow is aimed along the chord from the tip
  // to the point about one head length down the curve rather than along
  // the exact (vertical) start tangent: a tight curve bends away within
  // the head's own length, and the tangent then visibly misses it.
  const angle = quadStartAngle(sx, sy, sx, targetY, ex, ey);
  return {
    path: `M${sx},${sy} Q${sx},${targetY} ${ex},${ey}`,
    arrow: { x: sx, y: sy, angle },
  };
}

/**
 * Angle (degrees) of an arrow whose tip sits at the start of the
 * quadratic Bezier `p0, p1, p2`, aimed from the point one head length
 * along the curve back to the tip.
 */
function quadStartAngle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const chord = Math.hypot(x2 - x0, y2 - y0);
  const poly = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
  const length = (chord + poly) / 2;
  const t = length > 0 ? Math.min(1, ARROW_LENGTH_PX / length) : 1;
  const u = 1 - t;
  const bx = u * u * x0 + 2 * u * t * x1 + t * t * x2;
  const by = u * u * y0 + 2 * u * t * y1 + t * t * y2;
  return (Math.atan2(y0 - by, x0 - bx) * 180) / Math.PI;
}
</script>

<template>
  <g class="chart-annotations" pointer-events="none">
    <g v-for="(item, i) in items" :key="i" :style="blendStyle(item.blendMode)">
      <!--
        Outline pass. Each shape is rendered first in `outlineColor` at a
        wider stroke so the rule line, pointer, and arrow tip stay legible
        over busy series. Outline elements carry `class="annotation-outline"`
        so consumers (and tests) can target the "real" shape directly.
        Outlines deliberately drop `stroke-dasharray` — a dashed outline
        would expose gaps where legibility matters most.
      -->
      <line
        v-if="item.rule && item.outlineWidth > 0"
        v-bind="item.rule"
        class="annotation-outline"
        :stroke="item.outlineColor"
        :stroke-width="item.lineWidth + item.outlineWidth"
        stroke-linecap="round"
      />
      <path
        v-if="item.pointerPath && item.outlineWidth > 0"
        :d="item.pointerPath"
        class="annotation-outline"
        fill="none"
        :stroke="item.outlineColor"
        :stroke-width="item.lineWidth + item.outlineWidth"
        stroke-linecap="round"
      />
      <polygon
        v-if="item.arrowTip && item.outlineWidth > 0"
        :points="ARROW_POINTS"
        class="annotation-outline"
        :fill="item.outlineColor"
        :stroke="item.outlineColor"
        :stroke-width="item.outlineWidth"
        stroke-linejoin="round"
        :transform="item.arrowTransform"
      />
      <!-- Actual shapes. -->
      <line
        v-if="item.rule"
        v-bind="item.rule"
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
        :points="ARROW_POINTS"
        :fill="item.lineColor"
        :transform="item.arrowTransform"
      />
      <text
        :x="item.textX"
        :y="item.textY"
        :text-anchor="item.textAnchor"
        :font-size="item.fontSize"
        :font-weight="item.fontWeight"
        :fill="item.color"
        :stroke="item.textOutlineColor"
        :stroke-width="item.textOutlineWidth"
        :transform="item.textTransform"
        :dominant-baseline="item.textBaseline"
        stroke-linejoin="round"
        paint-order="stroke fill"
      >
        <!--
          dominant-baseline is repeated on the innermost tspans: WebKit
          only applies it on the element that holds the glyphs, so Safari
          drew hanging rotated labels on the baseline side.
        -->
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
            :dominant-baseline="item.textBaseline"
            >{{ run.text }}</tspan
          >
        </tspan>
      </text>
    </g>
  </g>
</template>
