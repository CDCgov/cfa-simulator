import { test, expect } from "@playwright/test";
import { scrollIntoSettledView } from "../_shared/e2e.testUtils.js";

test("BarChart thins crowded categorical labels", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  const chart = page.locator('[data-testid="thinned-bar-chart"]');
  await expect(chart).toBeVisible();
  const bars = chart.locator('[data-testid="bar"]');
  const ticks = chart.locator('[data-testid="category-tick"]');
  await expect(bars).toHaveCount(14);
  expect(await ticks.count()).toBeLessThan(14);
  expect(await ticks.count()).toBeGreaterThan(0);
});

test("horizontal bars make room for long category labels", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  const chart = page.locator('[data-testid="horizontal-bar-chart"]');
  await scrollIntoSettledView(chart);
  const ticks = chart.locator('[data-testid="category-tick"]');
  await expect(ticks).toHaveCount(5);
  const svgLeft = await ticks
    .first()
    .evaluate((tick) => tick.closest("svg")!.getBoundingClientRect().left);
  const barBox = (await chart
    .locator('[data-testid="bar"]')
    .first()
    .boundingBox())!;
  for (const tick of await ticks.all()) {
    const box = (await tick.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(svgLeft);
    expect(box.x + box.width).toBeLessThanOrEqual(barBox.x);
  }
});
