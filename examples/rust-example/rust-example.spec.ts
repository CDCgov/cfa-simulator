import { test, expect } from "@playwright/test";

test("rust example renders with number input", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h2")).toContainText("Reed-Frost Epidemic");
  await expect(page.locator("h1")).toContainText("Reed-Frost Epidemic");
  await expect(page.getByLabel("Population")).toBeVisible();
});
