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
