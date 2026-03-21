import { test, expect } from "@playwright/test";

test("LineChart page renders demos", async ({ page }) => {
  await page.goto("/docs/cfasim-ui/charts/line-chart");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().locator("svg")).toBeVisible();
  await expect(demos.first().locator("svg path")).toBeAttached();
});
