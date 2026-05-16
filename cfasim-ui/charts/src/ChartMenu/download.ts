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

/** Presentation attributes that may contain `var(--…)` references. The
 *  fallback inside `var(--name, #fff)` is the only thing that renders when
 *  the custom property is undefined outside the page context — so we
 *  resolve them against the document's CSS custom properties before
 *  serializing. */
const VAR_RESOLVABLE_ATTRS = ["fill", "stroke"] as const;

/** Resolve a single `var(--name)` or `var(--name, fallback)` expression.
 *  Looks the name up on `document.documentElement` (where theme tokens are
 *  declared); falls back to the in-expression fallback, then the original
 *  expression if neither resolves. */
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

/** Clone `svg` and inline the styles that don't survive a standalone render:
 *  inherited `color`/`font-*` on the root (so `currentColor` and unset
 *  font-family resolve), and any `var(--…)` references in fill/stroke
 *  attributes resolved against the document. */
export function prepareSvgForExport(svg: SVGSVGElement): SVGSVGElement {
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

  for (const target of clone.querySelectorAll<SVGElement>("*")) {
    for (const attr of VAR_RESOLVABLE_ATTRS) {
      const raw = target.getAttribute(attr);
      if (!raw || !raw.includes("var(")) continue;
      target.setAttribute(attr, resolveVarExpression(raw));
    }
  }

  return clone;
}

export function saveSvg(svg: SVGSVGElement, filename: string) {
  const clone = prepareSvgForExport(svg);
  const xml = new XMLSerializer().serializeToString(clone);
  downloadBlob(new Blob([xml], { type: "image/svg+xml" }), `${filename}.svg`);
}

export function savePng(svg: SVGSVGElement, filename: string) {
  const clone = prepareSvgForExport(svg);
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  const w = svg.width.baseVal.value || svg.clientWidth;
  const h = svg.height.baseVal.value || svg.clientHeight;
  const scale = 2;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${filename}.png`);
    });
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export function downloadCsv(csv: string, filename: string) {
  downloadBlob(new Blob([csv], { type: "text/csv" }), `${filename}.csv`);
}
