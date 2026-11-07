# Chart export

The chart menu's **Save PNG**, **Copy PNG**, **Save SVG**, **Copy SVG** and
**Download CSV** items (pick a subset with the chart's `menuItems` prop) are
built on helpers that `@cfasim-ui/charts` also exports, for export buttons,
reports, or bundling several charts into one download.

```ts
import {
  canCopyToClipboard,
  copyCanvasPng,
  copyPng,
  copySvg,
  downloadBlob,
  downloadCsv,
  prepareSvgForExport,
  saveCanvasPng,
  savePng,
  saveSvg,
  svgToPngBlob,
  svgToString,
} from "@cfasim-ui/charts";
```

## Getting a chart's svg

Each chart renders one root `<svg>` directly inside its wrapper, so query it
from a template ref on the chart or any ancestor:

```ts
const svg = el.querySelector<SVGSVGElement>(".line-chart-wrapper > svg")!;
```

The wrappers are `.line-chart-wrapper`, `.bar-chart-wrapper` and
`.choropleth-wrapper`. On a ChoroplethMap the first child svg holds the map;
city markers and state labels live in a second overlay svg that these helpers
(like the menu export) leave out. A canvas-rendered map has no svg for its
features; use `saveCanvasPng` with its `<canvas>`.

## Standalone svg

A chart's svg leans on the page for its colors and fonts: `currentColor`,
inherited `font-family`, and theme tokens such as `var(--color-bg-0)`, many of
which are `light-dark()` values. `prepareSvgForExport` returns a clone that
renders on its own: the root gets the inherited `color` and `font-*`, and every
`var()` or `light-dark()` fill and stroke is replaced by the color the page
currently shows, so a dark-mode export stays dark. The original is not
touched.

`svgToString` serializes that clone, and `saveSvg` downloads it.

```ts
const xml = svgToString(svg, { background: "white" });
saveSvg(svg, "cases", { background: "white" }); // cases.svg
```

Charts have transparent backgrounds. Pass `background` to paint one behind the
marks, for example the page color, so light text from a dark theme stays
readable in other viewers.

## PNG

`svgToPngBlob` rasterizes the standalone svg at its rendered size times
`scale` (default 2) and resolves to a PNG `Blob`. Use it when the image goes
somewhere other than a download, such as a zip or an upload. `savePng`
downloads the same image.

```ts
const png = await svgToPngBlob(svg, { scale: 3, background: "#fff" });
await savePng(svg, "cases"); // cases.png
```

## Clipboard

`copySvg` puts the standalone svg on the clipboard as plain text, which is
what Figma, Excalidraw, code editors and chat apps paste, plus an
`image/svg+xml` entry in browsers that support one (Chromium; Safari and
Firefox accept the type and drop it). `copyPng` copies the same PNG that
`svgToPngBlob` renders, and `copyCanvasPng` copies a canvas-rendered map.
All three resolve once the write succeeds and reject when the browser refuses
it, so call them straight from a click handler: Safari allows one clipboard
write per click and only inside the click's own tick, which is why `copyPng`
hands the browser a promise rather than awaiting the render first.

The async Clipboard API exists only in secure contexts (https or localhost),
and `canCopyToClipboard()` says whether it is available; the chart menu hides
its copy items otherwise.

```ts
button.addEventListener("click", () => {
  copySvg(svg, { background: "white" }).catch(() => notify("Copy failed"));
});
```

## Files

`downloadBlob(blob, name)` downloads any `Blob` under a full file name.
`downloadCsv(csv, filename)` and the `save*` helpers append the extension
themselves.

```ts
downloadCsv("day,cases\n0,1\n", "cases"); // cases.csv
downloadBlob(zipBlob, "outputs.zip");
```

## API

| Function                                     | Returns         | Description                                        |
| -------------------------------------------- | --------------- | -------------------------------------------------- |
| `prepareSvgForExport(svg, { background? })`  | `SVGSVGElement` | Standalone clone with colors and fonts inlined     |
| `svgToString(svg, { background? })`          | `string`        | Serialized standalone svg                          |
| `svgToPngBlob(svg, { scale?, background? })` | `Promise<Blob>` | PNG at `scale` (default 2) times the rendered size |
| `saveSvg(svg, filename, options?)`           | `void`          | Downloads `<filename>.svg`                         |
| `savePng(svg, filename, options?)`           | `Promise<void>` | Downloads `<filename>.png`                         |
| `saveCanvasPng(canvas, filename)`            | `Promise<void>` | Downloads a canvas's contents as `<filename>.png`  |
| `copySvg(svg, { background? })`              | `Promise<void>` | Copies the standalone svg to the clipboard         |
| `copyPng(svg, { scale?, background? })`      | `Promise<void>` | Copies the PNG to the clipboard                    |
| `copyCanvasPng(canvas)`                      | `Promise<void>` | Copies a canvas's contents to the clipboard as PNG |
| `canCopyToClipboard()`                       | `boolean`       | Whether the async Clipboard API is available       |
| `downloadCsv(csv, filename)`                 | `void`          | Downloads `<filename>.csv`                         |
| `downloadBlob(blob, name)`                   | `void`          | Downloads `blob` as `name`                         |
