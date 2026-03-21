import { test, expect } from "@playwright/test";

test("python example renders with number input", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h2")).toContainText("python-example");
  await expect(page.locator("h1")).toContainText("python-example");
  await expect(page.getByLabel("Base number")).toBeVisible();
});
