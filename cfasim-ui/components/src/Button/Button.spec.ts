import { test, expect } from "@playwright/test";

test("Button page renders demos", async ({ page }) => {
  await page.goto("/cfa-simulator/cfasim-ui/components/button");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(
    demos.first().getByRole("button", { name: "Primary" }),
  ).toBeVisible();
  await expect(
    demos.first().getByRole("button", { name: "Secondary" }),
  ).toBeVisible();

  // Disabled demo
  const disabledDemo = demos.nth(1);
  await expect(disabledDemo.getByRole("button").first()).toBeDisabled();
});
