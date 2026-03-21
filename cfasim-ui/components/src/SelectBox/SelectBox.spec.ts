import { test, expect } from "@playwright/test";

test("SelectBox page renders demos", async ({ page }) => {
  await page.goto("/cfa-simulator/cfasim-ui/components/select-box");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("Interval")).toBeVisible();
});
