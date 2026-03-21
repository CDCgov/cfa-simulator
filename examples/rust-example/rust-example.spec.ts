import { test, expect } from "@playwright/test";

test("rust example renders with number input", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h2")).toContainText("rust-example");
  await expect(page.locator("h1")).toContainText("rust-example");
  await expect(page.getByLabel("Base number")).toBeVisible();
});
