import { test, expect } from "@playwright/test";

test("NumberInput page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("Days")).toBeVisible();
  await expect(demos.first().locator('input[type="text"]')).toBeVisible();
});
