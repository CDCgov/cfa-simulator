import { test, expect } from "@playwright/test";

test("Toggle page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/toggle");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  const toggle = demos.first().getByRole("switch");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("data-state", "unchecked");
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-state", "checked");
});
