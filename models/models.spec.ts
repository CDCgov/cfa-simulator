import { test, expect } from "@playwright/test";

test("home page lists all models", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Models");
  const cards = page.locator(".model-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.nth(0)).toContainText("Reed-Frost Epidemic");
  await expect(cards.nth(1)).toContainText("Ixa Example");
  await expect(cards.nth(2)).toContainText("Python Example");
  await expect(cards.nth(3)).toContainText("Fetch Example");
  await expect(cards.nth(4)).toContainText("State Map");
});

test("reed-frost model renders", async ({ page }) => {
  await page.goto("/reed-frost");
  await expect(page.locator("h1")).toContainText("Reed-Frost Epidemic");
  await expect(page.getByLabel("Population")).toBeVisible();
});

test("ixa-example model renders", async ({ page }) => {
  await page.goto("/ixa-example");
  await expect(page.locator("h1")).toContainText("Ixa Example");
  await expect(page.getByLabel("Population")).toBeVisible();
  // Wait for the WASM to finish a run and the chart to draw.
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 30_000,
  });
  // Two LineCharts: cumulative infections and incidence.
  await expect(page.locator(".line-chart-wrapper")).toHaveCount(2);
});

test("ixa-example code editor seeds from current params", async ({ page }) => {
  await page.goto("/ixa-example");
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 30_000,
  });

  // The keyboard-driven editor flow (type → Cmd+S → Apply) is covered
  // exhaustively by ParamEditor.spec.ts against the demo page. Here we
  // just verify the page wires the toggle up so the editor reflects the
  // current params.
  await page.getByLabel("Edit as code").click();
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText(
    '"population": 10000',
  );
});

test("python example renders", async ({ page }) => {
  await page.goto("/python-example");
  await expect(page.locator("h1")).toContainText("Python Example");
  await expect(page.getByLabel("Steps")).toBeVisible();
});

test("fetch example renders", async ({ page }) => {
  await page.goto("/fetch-example");
  await expect(page.locator("h1")).toContainText("NSSP Emergency Department");
});

// The demo uses the canvas renderer, so there are no per-feature DOM paths —
// the (transparent) interaction svg is the click surface and canvas
// hit-testing resolves the feature. Clicking its center lands on a feature
// near the middle of the fitted region (contiguous-US center for the national
// view, mid-state for a single-state view) — always over land.
const clickMapCenter = (page: import("@playwright/test").Page) =>
  page
    .locator(".choropleth-wrapper > svg:not(.choropleth-city-overlay)")
    .click();

// Count painted (non-transparent) canvas pixels. Real maps paint hundreds of
// thousands; a fully-broken (all-NaN) projection paints ~0 and a degenerate one
// (e.g. a Mercator fallback that collapses to a point) paints only a handful —
// so a healthy floor catches both. It can't catch a NaN in a *few* of the ~3000
// counties (the rest still paint); that partial-projection case is covered by
// the component's SVG-renderer unit tests, where per-path `d` can be inspected.
const canvasPaintedPixels = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const c = document.querySelector(
      "canvas.choropleth-canvas",
    ) as HTMLCanvasElement | null;
    if (!c) return 0;
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) painted++;
    return painted;
  });
// Well below any real map, well above a blank/collapsed one.
const MIN_PAINTED = 2000;

test("state-map starts national (canvas counties) and drills into a clicked county's state", async ({
  page,
}) => {
  await page.goto("/state-map");
  await expect(page.locator(".subtitle")).toContainText("counties");
  await expect(page.locator("canvas.choropleth-canvas")).toBeVisible();
  expect(await canvasPaintedPixels(page)).toBeGreaterThan(MIN_PAINTED);
  // No info panel at the national level.
  await expect(page.locator(".info-panel")).toHaveCount(0);

  // Click a county → drill into its state's single-state map.
  await clickMapCenter(page);
  await expect(page.getByRole("button", { name: "Back to US" })).toBeVisible();
  await expect(page.locator(".info-panel")).toBeVisible();
  expect(await canvasPaintedPixels(page)).toBeGreaterThan(MIN_PAINTED);
});

test("state-map back button returns to the national view", async ({ page }) => {
  await page.goto("/state-map?selectedState=California");
  await expect(page.locator(".info-panel h2")).toHaveText("California");
  await page.getByRole("button", { name: "Back to US" }).click();
  await expect(page.locator(".info-panel")).toHaveCount(0);
  await expect(page.locator(".subtitle")).toContainText("counties");
});

test("state-map renders an island territory via the Mercator fallback", async ({
  page,
}) => {
  // geoAlbersUsa can't project Puerto Rico; the component must fall back to
  // geoMercator instead of emitting NaN (which would leave the canvas blank).
  await page.goto("/state-map?selectedState=Puerto%20Rico");
  await expect(page.locator("canvas.choropleth-canvas")).toBeVisible();
  expect(await canvasPaintedPixels(page)).toBeGreaterThan(MIN_PAINTED);
});

test("state-map shows county details and highlights without zooming", async ({
  page,
}) => {
  await page.goto("/state-map?selectedState=California");
  await expect(page.locator("canvas.choropleth-canvas")).toBeVisible();
  await clickMapCenter(page);
  // Clicking updates the info panel...
  await expect(page.locator(".info-panel .info-selection")).toBeVisible();
  // ...and highlights on the map without zooming (cities off ⇒ no zoom, no
  // zoom controls).
  await expect(page.locator(".chart-zoom-controls")).toHaveCount(0);
});

test("state-map outline toggle draws the exterior boundary", async ({
  page,
}) => {
  // SVG renderer so the outline is a real DOM path we can assert on.
  await page.goto("/state-map?renderer=svg&outline=on");
  const outline = page.locator(".choropleth-outline");
  await expect(outline).toHaveCount(1);
  await expect(outline).toHaveAttribute("stroke", /.+/);
  await expect(outline).toHaveAttribute("d", /.+/);
  // Toggling off removes the path entirely (the mesh is lazy).
  await page
    .getByRole("group", { name: "Outline" })
    .getByRole("button", { name: "Off" })
    .click();
  await expect(outline).toHaveCount(0);
});

test("state-map shows cities with level-of-detail, without overlapping labels", async ({
  page,
}) => {
  await page.goto("/state-map?cities=on");
  // Tiered markers: the biggest cities (and the capital) show at the base
  // overview, more reveal as you zoom in.
  await expect(page.locator(".choropleth-city-dot").first()).toBeVisible();
  await expect(page.locator(".choropleth-city-star")).toHaveCount(0);
  await expect(
    page.locator(".choropleth-city-label", { hasText: "Washington" }),
  ).toHaveCount(1);
  // Level-of-detail keeps the base overview uncluttered — only the top tier,
  // far fewer than the full ~100-city set.
  const baseCount = await page.locator(".choropleth-city-dot").count();
  expect(baseCount).toBeGreaterThan(0);
  expect(baseCount).toBeLessThan(15);
  expect(await canvasPaintedPixels(page)).toBeGreaterThan(MIN_PAINTED);

  // The collision pass must keep rendered labels apart. Compare label boxes
  // shrunk by the halo stroke so the anti-collision guarantee (on the text
  // fill) isn't masked by the decorative outline.
  const collided = await page.evaluate(() => {
    const INSET = 3;
    const rects = [...document.querySelectorAll(".choropleth-city-label")].map(
      (n) => {
        const r = (n as SVGGraphicsElement).getBoundingClientRect();
        return {
          left: r.left + INSET,
          right: r.right - INSET,
          top: r.top + INSET,
          bottom: r.bottom - INSET,
        };
      },
    );
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const disjoint =
          a.right <= b.left ||
          a.left >= b.right ||
          a.bottom <= b.top ||
          a.top >= b.bottom;
        if (!disjoint) return true;
      }
    }
    return false;
  });
  expect(collided).toBe(false);
});

test("city markers get the white halo and features the pointer cursor", async ({
  page,
}) => {
  // Guards the :deep() scoped-style fix: dots/labels/feature paths are
  // created imperatively (no data-v attribute), so plain scoped child
  // rules silently stop matching.
  await page.goto("/state-map?cities=on&renderer=svg");
  const dot = page.locator(".choropleth-city-dot").first();
  await dot.waitFor();
  const dotStyles = await dot.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { fill: cs.fill, stroke: cs.stroke };
  });
  expect(dotStyles.fill).toBe("rgb(26, 26, 26)");
  expect(dotStyles.stroke).toBe("rgb(255, 255, 255)");
  const label = page.locator(".choropleth-city-label").first();
  const labelStyles = await label.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { stroke: cs.stroke, paintOrder: cs.paintOrder };
  });
  expect(labelStyles.stroke).toBe("rgb(255, 255, 255)");
  expect(labelStyles.paintOrder).toBe("stroke");
  const cursor = await page
    .locator(".state-path")
    .first()
    .evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("pointer");
});

test("state-map cities overlay follows a drilled-in state's capital", async ({
  page,
}) => {
  await page.goto("/state-map?selectedState=Texas&cities=on");
  // Austin is the Texas capital → emphasized label, no star glyph (visible at
  // load since the demo uses cities-min-zoom=0).
  await expect(page.locator(".choropleth-city-star")).toHaveCount(0);
  await expect(
    page.locator(".choropleth-city-label-capital", { hasText: "Austin" }),
  ).toHaveCount(1);
  expect(await canvasPaintedPixels(page)).toBeGreaterThan(MIN_PAINTED);
});

test("fetch-example map is static until double-click activates zoom", async ({
  page,
}) => {
  await page.goto("/fetch-example");
  const path = page.locator(".state-path").first();
  await path.waitFor();
  // Static map advertises the gesture, and the controls are already there
  // (− and home disabled at the identity transform).
  await expect(page.locator(".choropleth-zoom-hint")).toHaveText(
    "Double click to zoom",
  );
  const home = page.getByRole("button", { name: "Reset view" });
  await expect(home).toBeDisabled();
  // The wheel never zooms.
  await path.hover();
  await page.mouse.wheel(0, -100);
  await expect(home).toBeDisabled();
  // Double-click zooms in place; the interaction is live from then on.
  await path.dblclick();
  await expect(home).toBeEnabled();
  await expect(page.locator(".choropleth-zoom-hint")).toHaveCount(0);
  // Home returns to full extent but activation is sticky — controls stay.
  await home.click();
  await expect(page.locator(".chart-zoom-controls")).toBeVisible();
});

test("fetch-example canvas renderer: no path DOM, zoom and hover work", async ({
  page,
}) => {
  await page.goto("/fetch-example?renderer=canvas");
  const canvas = page.locator("canvas.choropleth-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator(".state-path")).toHaveCount(0);
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Double-click zooms (interactions run on the transparent svg surface).
  await page.mouse.dblclick(cx, cy);
  await expect(page.getByRole("button", { name: "Reset view" })).toBeEnabled();
  // Wait out the zoom animation (hover stays suppressed mid-gesture),
  // then hover: picking resolves the feature and the tooltip appears.
  await page.waitForTimeout(400);
  await page.mouse.move(cx + 40, cy + 25);
  await page.mouse.move(cx + 42, cy + 27);
  await expect(page.locator(".chart-tooltip-content")).toBeVisible();
});

test.describe("choropleth touch zoom", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 664 } });

  test("double tap expands the map to fill the window and ✕ closes it", async ({
    page,
  }) => {
    await page.goto("/fetch-example");
    const path = page.locator(".state-path").first();
    await path.waitFor();
    await expect(page.locator(".choropleth-zoom-hint")).toHaveText(
      "Double tap to zoom",
    );
    // Two quick taps at the same point — a double tap, the zoom gesture.
    const box = (await path.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.touchscreen.tap(cx, cy);
    await page.touchscreen.tap(cx, cy);
    await expect(
      page.locator(".choropleth-wrapper.is-fullscreen"),
    ).toBeVisible();
    await expect(page.locator(".chart-zoom-controls")).toBeVisible();
    await page.locator(".chart-close-button").tap();
    await expect(page.locator(".choropleth-wrapper.is-fullscreen")).toHaveCount(
      0,
    );
    await expect(page.locator(".chart-zoom-controls")).toHaveCount(0);
  });

  test("taps still select and show tooltips once the map owns gestures", async ({
    page,
  }) => {
    // Once expanded, the d3-zoom filter accepts touches and d3 calls
    // stopImmediatePropagation on them — the component's tap listeners
    // must be registered first or taps go dead (selection + tooltip).
    await page.goto("/fetch-example");
    const path = page.locator(".state-path").first();
    await path.waitFor();
    const box = (await path.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const expanded = page.locator(".choropleth-wrapper.is-fullscreen");
    await expect(expanded).toBeVisible();
    // Let the enter animation settle, then tap the middle of the map —
    // central US, guaranteed to be a county in the counties view.
    await page.waitForTimeout(700);
    const svgBox = (await expanded
      .locator("svg:has(.state-path)")
      .boundingBox())!;
    await page.touchscreen.tap(
      svgBox.x + svgBox.width / 2,
      svgBox.y + svgBox.height / 2,
    );
    // Expanded touch view presents the tooltip as a bottom sheet.
    await expect(page.locator(".chart-tooltip-sheet")).toHaveClass(/is-open/);
  });

  test("canvas renderer: double tap expands and taps show the sheet", async ({
    page,
  }) => {
    await page.goto("/fetch-example?renderer=canvas");
    const canvas = page.locator("canvas.choropleth-canvas");
    await canvas.waitFor();
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.touchscreen.tap(cx, cy);
    await page.touchscreen.tap(cx, cy);
    await expect(
      page.locator(".choropleth-wrapper.is-fullscreen"),
    ).toBeVisible();
    await page.waitForTimeout(700);
    const fsCanvas = page.locator(".choropleth-wrapper.is-fullscreen canvas");
    const b2 = (await fsCanvas.boundingBox())!;
    await page.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await expect(page.locator(".chart-tooltip-sheet")).toHaveClass(/is-open/);
  });
});

test("python-example syncs params to URL and hydrates from URL", async ({
  page,
}) => {
  await page.goto("/python-example?steps=25&rate=4.5");
  const stepsInput = page.getByLabel("Steps");
  const rateInput = page.getByLabel("Rate");
  await expect(stepsInput).toHaveValue("25");
  await expect(rateInput).toHaveValue("4.5");

  // Change a param and confirm it lands in the URL (300ms debounce).
  await stepsInput.fill("40");
  await stepsInput.press("Tab");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("steps"))
    .toBe("40");

  // Reset rate to default — should drop from the URL.
  await rateInput.fill("2.5");
  await rateInput.press("Tab");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("rate"))
    .toBeNull();

  // Reset button clears all query params.
  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(stepsInput).toHaveValue("10");
});
