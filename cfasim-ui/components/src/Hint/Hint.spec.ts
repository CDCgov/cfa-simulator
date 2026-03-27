import { test, expect } from "@playwright/test";

test("Hint page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/hint");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("Population size")).toBeVisible();
  await expect(
    demos.first().getByRole("button", { name: "More info" }),
  ).toBeVisible();
});
