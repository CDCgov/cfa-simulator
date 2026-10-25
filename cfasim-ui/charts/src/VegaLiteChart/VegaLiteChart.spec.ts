import { test, expect } from "@playwright/test";

test("VegaLiteChart renders specs as native charts", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("./cfasim-ui/charts/vega-lite-chart");
  await expect(page.locator("h1")).toBeVisible();

  // A color field makes one line per region, on weekly date ticks.
  const line = page.locator('[data-testid="vega-line"]');
  await expect(line.locator("svg path[fill='none']")).toHaveCount(2);
  await expect(line.getByText("Jan 05", { exact: true })).toBeVisible();
  await expect(line.getByText("Jan 12", { exact: true })).toBeVisible();

  // The threshold rule is drawn across the band chart.
  const band = page.locator('[data-testid="vega-band"]');
  await band.scrollIntoViewIfNeeded();
  await expect(band.locator("line[stroke-dasharray]").first()).toBeAttached();

  // Stacked bars: two statuses for each of four age groups.
  const bars = page.locator('[data-testid="vega-bar"]');
  await bars.scrollIntoViewIfNeeded();
  await expect(bars.locator('[data-testid="bar"]')).toHaveCount(8);

  expect(errors).toEqual([]);
});
