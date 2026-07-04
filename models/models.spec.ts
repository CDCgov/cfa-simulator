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

const mapHasNaN = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("svg path")).some((p) =>
      (p.getAttribute("d") ?? "").includes("NaN"),
    ),
  );

test("state-map starts national and drills into a clicked state", async ({
  page,
}) => {
  await page.goto("/state-map");
  await expect(page.locator(".subtitle")).toContainText("Click a state");
  await expect(page.locator("svg path").first()).toBeVisible();
  expect(await mapHasNaN(page)).toBe(false);
  // No info panel at the national level.
  await expect(page.locator(".info-panel")).toHaveCount(0);

  // Click a state → transition into its single-state map.
  await page.locator(".state-path").first().click();
  await expect(page.getByRole("button", { name: "Back to US" })).toBeVisible();
  await expect(page.locator(".info-panel")).toBeVisible();
  expect(await mapHasNaN(page)).toBe(false);
});

test("state-map back button returns to the national view", async ({ page }) => {
  await page.goto("/state-map?selectedState=California");
  await expect(page.locator(".info-panel h2")).toHaveText("California");
  await page.getByRole("button", { name: "Back to US" }).click();
  await expect(page.locator(".info-panel")).toHaveCount(0);
  await expect(page.locator(".subtitle")).toContainText("Click a state");
});

test("state-map renders an island territory via the Mercator fallback", async ({
  page,
}) => {
  // geoAlbersUsa can't project Puerto Rico; the component must fall back to
  // geoMercator instead of emitting NaN path data.
  await page.goto("/state-map?selectedState=Puerto%20Rico");
  await expect(page.locator("svg path").first()).toBeVisible();
  expect(await mapHasNaN(page)).toBe(false);
});

test("state-map shows county details and highlights without zooming", async ({
  page,
}) => {
  await page.goto("/state-map?selectedState=California");
  await expect(page.locator(".state-path").first()).toBeVisible();
  await page.locator(".state-path").first().click();
  // Clicking updates the info panel...
  await expect(page.locator(".info-panel .info-selection")).toBeVisible();
  // ...and highlights on the map without zooming (no zoom controls).
  await expect(page.locator(".chart-zoom-controls")).toHaveCount(0);
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
    await expect(page.locator(".chart-tooltip-content")).toBeVisible();
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
