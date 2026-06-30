import { test, expect, type Page } from "@playwright/test";

function attachCiBrowserDiagnostics(page: Page, testTitle: string) {
  if (!process.env.CI || !testTitle.toLowerCase().includes("r example")) {
    return;
  }

  page.on("console", (message) => {
    // Emit browser logs in CI so R/webR errors are visible in job output.
    console.log(`[browser:${message.type()}] ${message.text()}`);
  });

  page.on("pageerror", (error) => {
    console.log(`[pageerror] ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    console.log(
      `[requestfailed] ${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
    );
  });

  page.on("response", (response) => {
    if (response.ok()) return;

    const url = response.url();
    if (url.includes("/rwasm/") || url.includes("/webr")) {
      console.log(
        `[bad-response] ${response.status()} ${response.request().method()} ${url}`,
      );
    }
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  attachCiBrowserDiagnostics(page, testInfo.title);
});

test("home page lists all models", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Models");
  const cards = page.locator(".model-card");
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(0)).toContainText("Reed-Frost Epidemic");
  await expect(cards.nth(1)).toContainText("Ixa Example");
  await expect(cards.nth(2)).toContainText("Python Example");
  await expect(cards.nth(3)).toContainText("R Example");
  await expect(cards.nth(4)).toContainText("Fetch Example");
  await expect(cards.nth(5)).toContainText("State Map");
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
  // ...and highlights on the map without zooming (no Reset button).
  await expect(page.locator(".choropleth-reset")).toHaveCount(0);
});

test("r example renders", async ({ page }) => {
  await page.goto("/r-example");
  await expect(page.locator("h1")).toContainText("R Example");
  await expect(page.getByLabel("Steps")).toBeVisible();
  // The R model must actually run in webR and produce output, not just mount —
  // a broken runtime would leave loading/error up with no series rows.
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(10, { timeout: 60_000 });
  await expect(rows.first()).toContainText("t=0, v=0");
  await expect(page.getByText("Loading...")).toHaveCount(0);
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

test("r-example syncs params to URL and hydrates from URL", async ({
  page,
}) => {
  await page.goto("/r-example?steps=25&rate=4.5");
  const stepsInput = page.getByLabel("Steps");
  const rateInput = page.getByLabel("Rate");
  await expect(stepsInput).toHaveValue("25");
  await expect(rateInput).toHaveValue("4.5");
  // The URL-provided steps must drive the model output (25 series rows).
  await expect(page.getByRole("listitem")).toHaveCount(25, { timeout: 60_000 });

  await stepsInput.fill("40");
  await stepsInput.press("Tab");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("steps"))
    .toBe("40");

  await rateInput.fill("2.5");
  await rateInput.press("Tab");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("rate"))
    .toBeNull();

  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(stepsInput).toHaveValue("10");
});
