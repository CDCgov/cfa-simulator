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

test("state-map renders a single state without NaN paths", async ({ page }) => {
  await page.goto("/state-map");
  await expect(page.locator("h1")).toContainText("State-level map");
  await expect(page.locator("svg path").first()).toBeVisible();
  const hasNaN = await page.evaluate(() =>
    Array.from(document.querySelectorAll("svg path")).some((p) =>
      (p.getAttribute("d") ?? "").includes("NaN"),
    ),
  );
  expect(hasNaN).toBe(false);
});

test("state-map renders an island territory via the Mercator fallback", async ({
  page,
}) => {
  // geoAlbersUsa can't project Puerto Rico; the component must fall back to
  // geoMercator instead of emitting NaN path data.
  await page.goto("/state-map?selectedState=Puerto%20Rico");
  await expect(page.locator("svg path").first()).toBeVisible();
  const hasNaN = await page.evaluate(() =>
    Array.from(document.querySelectorAll("svg path")).some((p) =>
      (p.getAttribute("d") ?? "").includes("NaN"),
    ),
  );
  expect(hasNaN).toBe(false);
});

test("state-map highlights a parent HSA when a county is clicked", async ({
  page,
}) => {
  await page.goto("/state-map");
  await expect(page.locator(".state-path").first()).toBeVisible();
  await page.locator(".state-path").first().click();
  // The parent HSA renders as a cross-geoType overlay (lazy HSA module).
  await expect(page.locator(".focus-overlay")).toBeVisible({ timeout: 10_000 });
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
