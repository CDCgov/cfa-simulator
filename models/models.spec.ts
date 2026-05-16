import { test, expect } from "@playwright/test";

test("home page lists all models", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Models");
  const cards = page.locator(".model-card");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("Reed-Frost Epidemic");
  await expect(cards.nth(1)).toContainText("Ixa Example");
  await expect(cards.nth(2)).toContainText("Python Example");
  await expect(cards.nth(3)).toContainText("Fetch Example");
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

test("ixa-example toggles to code editor and applies a saved param", async ({
  page,
}) => {
  await page.goto("/ixa-example");
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel("Edit as code").click();
  const editor = page.locator(".cm-editor");
  await expect(editor).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText('"population"');

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(
    JSON.stringify(
      {
        infectionRate: 0.5,
        infectiousPeriod: 3.0,
        population: 500,
        initialInfections: 5,
        seed: 0,
        maxTime: 100,
        nSimulations: 5,
      },
      null,
      2,
    ),
  );
  await page.keyboard.press("ControlOrMeta+s");

  // Toggle back to the form and confirm Population was applied.
  await page.getByLabel("Edit as code").click();
  await expect(page.getByLabel("Population")).toHaveValue("500");
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
