// Canvas rendering backend for ChoroplethMap (`renderer="canvas"`).
//
// Pure scene/draw/pick helpers, kept free of Vue and DOM lookups so they
// can be unit-tested against a recording fake context. The component owns
// all state; these functions just paint and answer point queries.

/** Matches ChoroplethMap's FocusStyle without importing from the SFC. */
export type CanvasDashStyle = "solid" | "dashed" | "dotted";

export interface SceneItem {
  id: string;
  path: Path2D;
  fill: string;
}

export interface CanvasScene {
  items: SceneItem[];
  indexById: Map<string, number>;
  /**
   * Every feature stroke concatenated into one path — features share a
   * stroke color, and one native stroke call beats thousands (WebKit's
   * canvas2D especially).
   */
  featureStrokes: Path2D | null;
  /**
   * Stroke for a feature kept OUT of `featureStrokes` because its geometry
   * is swapped at runtime (the zoom-aware enlarged DC): a concatenated
   * Path2D can't be edited, so this one strokes separately after it.
   */
  raisedStroke: Path2D | null;
  /** State-borders mesh (counties / hsas mode). */
  borders: Path2D | null;
  /**
   * County-borders mesh over HSA / state-level maps (theme.countyBorders).
   * Like `exterior`, built lazily by the component when its color resolves
   * visible — mutable scene state rather than a buildScene input.
   */
  countyBorders: Path2D | null;
  /**
   * HSA-borders mesh over county / state-level maps (theme.hsaBorders).
   * Lazily built by the component like `countyBorders`.
   */
  hsaBorders: Path2D | null;
  /**
   * Exterior boundary of the rendered geography (theme.outline). Built
   * lazily by the component when the outline resolves visible, so it is
   * mutable scene state rather than a buildScene input.
   */
  exterior: Path2D | null;
}

export interface CanvasView {
  dpr: number;
  /** Uniform viewBox→CSS scale (xMidYMid meet). */
  meetScale: number;
  /** CSS-px letterbox offsets inside the canvas box. */
  offsetX: number;
  offsetY: number;
  zoom: { k: number; x: number; y: number };
}

export interface CanvasOverlayItem {
  path: Path2D;
  stroke: string;
  strokeWidth?: number;
  style?: CanvasDashStyle;
}

export interface CanvasHighlightItem {
  stroke?: string;
  strokeWidth?: number;
  style?: CanvasDashStyle;
}

export interface CanvasBaseState {
  strokeColor: string;
  /** Base feature stroke width in CSS px (effectiveStrokeWidth). */
  strokeWidth: number;
  /** State-borders mesh color (resolved theme.borders). */
  bordersColor: string;
  /** State-borders mesh width in CSS px; 0 disables. */
  bordersWidth: number;
  /** County-borders mesh color; undefined = off (resolved theme.countyBorders). */
  countyBordersColor: string | undefined;
  /** County-borders mesh width in CSS px; 0 disables (also the LOD gate). */
  countyBordersWidth: number;
  /** HSA-borders mesh color; undefined = off (resolved theme.hsaBorders). */
  hsaBordersColor: string | undefined;
  /** HSA-borders mesh width in CSS px; 0 disables. */
  hsaBordersWidth: number;
  /** Exterior outline color; undefined = off (resolved theme.outline). */
  outlineColor: string | undefined;
  /** Exterior outline width in CSS px; 0 disables. */
  outlineWidth: number;
  /** Background wash painted before fills; undefined = off. */
  background: string | undefined;
  /** Resolved highlight color (light-dark() can't paint on canvas). */
  highlightStroke: string;
  focused: Map<string, CanvasHighlightItem>;
  overlays: CanvasOverlayItem[];
}

export interface CanvasDrawState extends CanvasBaseState {
  hoveredId: string | null;
}

function applyViewTransform(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
): void {
  const s = view.dpr * view.meetScale * view.zoom.k;
  ctx.setTransform(
    s,
    0,
    0,
    s,
    view.dpr * (view.offsetX + view.meetScale * view.zoom.x),
    view.dpr * (view.offsetY + view.meetScale * view.zoom.y),
  );
}

/** Line width (map units) rendering as `css` CSS px on screen. */
function lwFor(view: CanvasView): (css: number) => number {
  return (css) => css / (view.meetScale * view.zoom.k || 1);
}

function applyLineDash(
  ctx: CanvasRenderingContext2D,
  lw: (css: number) => number,
  style: CanvasDashStyle | undefined,
): void {
  if (style === "dashed") {
    ctx.setLineDash([lw(8), lw(4)]);
    ctx.lineCap = "butt";
  } else if (style === "dotted") {
    ctx.setLineDash([0, lw(5)]);
    ctx.lineCap = "round";
  } else {
    ctx.setLineDash([]);
    ctx.lineCap = "butt";
  }
}

export function buildScene(
  features: Array<{ id?: string | number | null }>,
  pathFor: (feature: never) => string | null,
  colorFor: (id: string) => string,
  bordersD?: string | null,
  raisedId?: string | null,
): CanvasScene {
  const items: SceneItem[] = [];
  const indexById = new Map<string, number>();
  const featureStrokes = new Path2D();
  let strokeCount = 0;
  let raisedStroke: Path2D | null = null;
  for (const feat of features) {
    const d = pathFor(feat as never);
    if (!d) continue;
    const id = String(feat.id);
    const path = new Path2D(d);
    indexById.set(id, items.length);
    items.push({ id, path, fill: colorFor(id) });
    if (raisedId != null && id === raisedId) {
      raisedStroke = path;
    } else if (typeof featureStrokes.addPath === "function") {
      featureStrokes.addPath(path);
      strokeCount++;
    }
  }
  return {
    items,
    indexById,
    featureStrokes: strokeCount ? featureStrokes : null,
    raisedStroke,
    borders: bordersD ? new Path2D(bordersD) : null,
    countyBorders: null,
    hsaBorders: null,
    exterior: null,
  };
}

function highlightOne(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  lw: (css: number) => number,
  state: CanvasBaseState,
  id: string,
  item?: CanvasHighlightItem,
): void {
  const idx = scene.indexById.get(id);
  if (idx == null) return;
  const it = scene.items[idx];
  // Re-filling first covers neighbors' strokes — the canvas equivalent of
  // the SVG renderer's appendChild raise.
  ctx.fillStyle = it.fill;
  ctx.fill(it.path);
  ctx.strokeStyle = item?.stroke ?? state.highlightStroke;
  ctx.lineWidth = lw(item?.strokeWidth ?? state.strokeWidth + 1);
  applyLineDash(ctx, lw, item?.style);
  ctx.stroke(it.path);
}

/**
 * Base pass internals composed by drawScene. The transform maps canonical
 * viewBox coordinates to device pixels:
 * `device = dpr · (letterboxOffset + meetScale · zoom(point))`. Stroke
 * widths are compensated so a visual width `w` CSS px stays constant at
 * any zoom, mirroring the SVG renderer's `strokeDivisor`.
 */
function beginBasePass(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  background?: string,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  applyViewTransform(ctx, view);
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
}

/** Fills items [from, to); returns the next index. The ctx keeps the
 * transform beginBasePass applied, so slices can span multiple frames. */
function drawFillSlice(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  from: number,
  to: number,
): number {
  const end = Math.min(to, scene.items.length);
  for (let i = from; i < end; i++) {
    ctx.fillStyle = scene.items[i].fill;
    ctx.fill(scene.items[i].path);
  }
  return end;
}

/** Feature strokes, borders, the exterior outline, focus highlights, and
 * overlays — everything but the transient hover, which the display frame
 * draws live on top of blits. */
function finishBasePass(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  view: CanvasView,
  state: CanvasBaseState,
): void {
  const lw = lwFor(view);
  ctx.setLineDash([]);
  // A zero width disables a stroke layer entirely: canvas ignores
  // `lineWidth = 0` (keeping the previous width), so skip explicitly.
  if (state.strokeWidth > 0) {
    ctx.lineWidth = lw(state.strokeWidth);
    ctx.strokeStyle = state.strokeColor;
    if (scene.featureStrokes) {
      ctx.stroke(scene.featureStrokes);
    } else {
      for (const item of scene.items) ctx.stroke(item.path);
    }
    if (scene.raisedStroke && scene.featureStrokes) {
      ctx.stroke(scene.raisedStroke);
    }
  }

  // Decor meshes below the state mesh, finest first, mirroring the SVG
  // z-order: county borders, then HSA borders.
  if (
    scene.countyBorders &&
    state.countyBordersColor &&
    state.countyBordersWidth > 0
  ) {
    ctx.lineWidth = lw(state.countyBordersWidth);
    ctx.strokeStyle = state.countyBordersColor;
    ctx.stroke(scene.countyBorders);
  }

  if (scene.hsaBorders && state.hsaBordersColor && state.hsaBordersWidth > 0) {
    ctx.lineWidth = lw(state.hsaBordersWidth);
    ctx.strokeStyle = state.hsaBordersColor;
    ctx.stroke(scene.hsaBorders);
  }

  if (scene.borders && state.bordersWidth > 0) {
    ctx.lineWidth = lw(state.bordersWidth);
    ctx.strokeStyle = state.bordersColor;
    ctx.stroke(scene.borders);
  }

  // Exterior outline paints above interior borders, below highlights.
  if (scene.exterior && state.outlineColor && state.outlineWidth > 0) {
    ctx.lineWidth = lw(state.outlineWidth);
    ctx.strokeStyle = state.outlineColor;
    ctx.stroke(scene.exterior);
  }

  for (const [id, item] of state.focused) {
    highlightOne(ctx, scene, lw, state, id, item);
  }

  // Overlays above the focus highlights, matching the SVG z-order.
  for (const o of state.overlays) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = lw(o.strokeWidth ?? state.strokeWidth + 1.5);
    applyLineDash(ctx, lw, o.style);
    ctx.stroke(o.path);
  }
  ctx.setLineDash([]);
}

/** Live hover highlight, drawn by the display frame on top of the blitted
 * base (focused features are already highlighted in the base itself). */
export function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  view: CanvasView,
  state: CanvasBaseState,
  hoveredId: string | null,
): void {
  if (!hoveredId || state.focused.has(hoveredId)) return;
  applyViewTransform(ctx, view);
  ctx.lineJoin = "round";
  highlightOne(ctx, scene, lwFor(view), state, hoveredId);
  ctx.setLineDash([]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Everything but the transient hover: clear, background, fills, feature
 * strokes, borders, exterior outline, focus highlights, overlays. Split out
 * so the component can cache this to an offscreen canvas and, on a
 * hover-only change, blit it back + redraw the one highlight instead of
 * re-filling every feature.
 */
export function drawBase(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  view: CanvasView,
  state: CanvasDrawState,
): void {
  beginBasePass(ctx, view, state.background);
  drawFillSlice(ctx, scene, 0, scene.items.length);
  finishBasePass(ctx, scene, view, state);
}

/** One-shot full repaint: the base pass plus the hover highlight on top. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  view: CanvasView,
  state: CanvasDrawState,
): void {
  drawBase(ctx, scene, view, state);
  drawHoverHighlight(ctx, scene, view, state, state.hoveredId);
}

/** Unique fill color for feature index `i` on the picking canvas. */
export function indexToColor(i: number): string {
  const v = i + 1;
  return `rgb(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255})`;
}

/**
 * Paints every feature in a unique index color onto `canvas` at canonical
 * viewBox resolution. Rebuilt only when the geometry changes; hit-testing
 * then reads one pixel per query regardless of feature count.
 */
export function buildPicking(
  scene: CanvasScene,
  width: number,
  height: number,
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  scene.items.forEach((item, i) => {
    ctx.fillStyle = indexToColor(i);
    ctx.fill(item.path);
  });
  return ctx;
}

/**
 * Feature index at canonical viewBox coordinates (the caller has already
 * inverted the zoom transform), or null over the background. Fill edges
 * antialias into blended colors, so a candidate whose decoded index is
 * implausible — or that fails a point-in-path check — falls back to a
 * linear `isPointInPath` scan (rare, borders only).
 */
export function pickIndexAt(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  x: number,
  y: number,
): number | null {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= ctx.canvas.width || py >= ctx.canvas.height) {
    return null;
  }
  const d = ctx.getImageData(px, py, 1, 1).data;
  if (d[3] === 0) return null;
  const idx = ((d[0] << 16) | (d[1] << 8) | d[2]) - 1;
  if (idx >= 0 && idx < scene.items.length) {
    if (
      typeof ctx.isPointInPath !== "function" ||
      ctx.isPointInPath(scene.items[idx].path, x, y)
    ) {
      return idx;
    }
  }
  // Antialiased edge pixel: verify the hard way.
  if (typeof ctx.isPointInPath === "function") {
    for (let i = 0; i < scene.items.length; i++) {
      if (ctx.isPointInPath(scene.items[i].path, x, y)) return i;
    }
  }
  return null;
}
