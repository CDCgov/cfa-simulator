import { test, expect } from "@playwright/test";

test("fetch example renders with select inputs", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText(
    "COVID-19 Hospital Admissions",
  );
  await expect(page.getByText("Reference date")).toBeVisible();
  await expect(page.getByText("Location")).toBeVisible();
});
