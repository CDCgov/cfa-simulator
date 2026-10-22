/** Download `blob` as a file named `name` (extension included). */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Inherited CSS properties propagated onto the cloned SVG root so text and
 *  `currentColor` strokes render with the same color/typography as the
 *  live chart when the SVG is opened standalone or rasterized to PNG. */
const ROOT_INHERITED_PROPS = [
  "color",
  "font-family",
  "font-size",
  "font-weight",
] as const;

/** Presentation attributes that may contain `var(--…)` or `light-dark(…)`.
 *  Neither resolves in a standalone file, so they are replaced with the
 *  paint the live element computed before serializing. */
const VAR_RESOLVABLE_ATTRS = ["fill", "stroke"] as const;
const THEME_PAINT = /var\(|light-dark\(/;

/** Fallback when the live element has no computed paint (happy-dom): look a
 *  single `var(--name, fallback)` up on `document.documentElement`. A token
 *  defined with `light-dark()` or another `var()` comes back unresolved. */
function resolveVarExpression(expr: string): string {
  const match = expr.match(
    /^\s*var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*?)\s*)?\)\s*$/,
  );
  if (!match) return expr;
  const [, name, fallback] = match;
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (value) return value;
  if (fallback) return fallback.trim();
  return expr;
}

export interface SvgExportOptions {
  /** Fill painted behind the chart. Default: none (transparent). */
  background?: string;
}

/** Clone `svg` and inline the styles that don't survive a standalone render:
 *  inherited `color`/`font-*` on the root (so `currentColor` and unset
 *  font-family resolve), and `var(--…)` / `light-dark(…)` fill and stroke
 *  attributes replaced by the colors the page shows. */
export function prepareSvgForExport(
  svg: SVGSVGElement,
  options: SvgExportOptions = {},
): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const rootComputed = window.getComputedStyle(svg);
  const rootStyleParts: string[] = [];
  for (const prop of ROOT_INHERITED_PROPS) {
    const value = rootComputed.getPropertyValue(prop);
    if (value) rootStyleParts.push(`${prop}: ${value}`);
  }
  const existingRootStyle = clone.getAttribute("style") ?? "";
  clone.setAttribute(
    "style",
    [existingRootStyle, ...rootStyleParts].filter(Boolean).join("; "),
  );

  // cloneNode keeps the tree shape, so the two lists line up by index.
  const live = svg.querySelectorAll<SVGElement>("*");
  clone.querySelectorAll<SVGElement>("*").forEach((target, i) => {
    for (const attr of VAR_RESOLVABLE_ATTRS) {
      const raw = target.getAttribute(attr);
      if (!raw || !THEME_PAINT.test(raw)) continue;
      const computed = window.getComputedStyle(live[i]).getPropertyValue(attr);
      target.setAttribute(attr, computed || resolveVarExpression(raw));
    }
  });

  if (options.background) {
    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("fill", options.background);
    clone.insertBefore(rect, clone.firstChild);
  }

  return clone;
}

/** Serialize a standalone copy of `svg` (see `prepareSvgForExport`). */
export function svgToString(
  svg: SVGSVGElement,
  options: SvgExportOptions = {},
): string {
  return new XMLSerializer().serializeToString(
    prepareSvgForExport(svg, options),
  );
}

/** Download a standalone copy of `svg` as `<filename>.svg`. */
export function saveSvg(
  svg: SVGSVGElement,
  filename: string,
  options: SvgExportOptions = {},
) {
  downloadBlob(
    new Blob([svgToString(svg, options)], { type: "image/svg+xml" }),
    `${filename}.svg`,
  );
}

export interface PngExportOptions extends SvgExportOptions {
  /** Pixels per CSS pixel. Default: 2. */
  scale?: number;
}

/** Rasterize `svg` to a PNG blob at its rendered size times `scale`. */
export async function svgToPngBlob(
  svg: SVGSVGElement,
  options: PngExportOptions = {},
): Promise<Blob> {
  const { scale = 2 } = options;
  const w = svg.width.baseVal.value || svg.clientWidth;
  const h = svg.height.baseVal.value || svg.clientHeight;
  const url = URL.createObjectURL(
    new Blob([svgToString(svg, options)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render the chart SVG"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Could not encode the chart PNG");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Download `svg` rasterized as `<filename>.png`. */
export async function savePng(
  svg: SVGSVGElement,
  filename: string,
  options: PngExportOptions = {},
) {
  downloadBlob(await svgToPngBlob(svg, options), `${filename}.png`);
}

/**
 * Downloads a rendering canvas's current contents as a PNG — no SVG
 * round-trip. The canvas backing store is already sized at
 * devicePixelRatio, so the export is naturally high-resolution.
 */
export function saveCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${filename}.png`);
  }, "image/png");
}

/** Download `csv` as `<filename>.csv`. */
export function downloadCsv(csv: string, filename: string) {
  downloadBlob(new Blob([csv], { type: "text/csv" }), `${filename}.csv`);
}
