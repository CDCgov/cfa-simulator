import { test, expect } from "@playwright/test";

test("Icon page renders demos", async ({ page }) => {
  await page.goto("/cfa-simulator/cfasim-ui/components/icon");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().locator(".Icon")).toHaveCount(3);
});
