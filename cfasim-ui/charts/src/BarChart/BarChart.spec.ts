import { test, expect } from "@playwright/test";

test("BarChart page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  const chartSvg = demos.first().locator("svg").last();
  await expect(chartSvg).toBeVisible();
  await expect(chartSvg.locator('[data-testid="bar"]').first()).toBeAttached();
});

test("BarChart thins crowded categorical labels", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  const chart = page.locator('[data-testid="thinned-bar-chart"]');
  await expect(chart).toBeVisible();
  const bars = chart.locator('[data-testid="bar"]');
  const ticks = chart.locator('[data-testid="category-tick"]');
  // Every category still gets a bar; only labels are thinned.
  await expect(bars).toHaveCount(14);
  expect(await ticks.count()).toBeLessThan(14);
  expect(await ticks.count()).toBeGreaterThan(0);
});
